import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";
import { getModelCreditCost, creditsKey } from "@/lib/credits";
import { getProviderHealth, pickAutoModel } from "@/lib/ai-health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const ratelimit = redisUrl && redisToken
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl, token: redisToken }),
      limiter: Ratelimit.slidingWindow(30, "1 d"),
      analytics: true,
    })
  : null;

function secondsUntilMidnight(): number {
  const now = new Date();
  const bangkokNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const tomorrow = new Date(bangkokNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.max(Math.ceil((tomorrow.getTime() - bangkokNow.getTime()) / 1000), 60);
}

export async function POST(request: NextRequest) {
  if (ratelimit) {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success } = await ratelimit.limit(`ratelimit_${ip}`);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getSessionInfo(token);
  if (!user?.email) return NextResponse.json({ error: "User not found" }, { status: 401 });

  const body = await request.json();
  const { messages, model: requestedModel, language: rawLanguage, customInstructions, generateImage, canvasMode, memoryEnabled } = body;
  
  const MAX_HISTORY = 12;
  const truncatedMessages = Array.isArray(messages) ? messages.slice(-MAX_HISTORY) : [];
  const language = ["th", "en", "zh", "ja", "ko"].includes(rawLanguage) ? rawLanguage : "th";

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const thaillmApiKey = process.env.THAILLM_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  const health = await getProviderHealth();
  let modelToUse = requestedModel || "auto";

  if (modelToUse === "auto") {
    const lastMsg = truncatedMessages[truncatedMessages.length - 1]?.content || "";
    const isComplex = truncatedMessages.length > 8 || lastMsg.length > 400 || canvasMode;
    modelToUse = pickAutoModel(
      health, 
      isComplex, 
      !!openRouterApiKey, 
      !!geminiApiKey, 
      !!claudeApiKey, 
      !!thaillmApiKey,
      !!groqApiKey,
      !!githubToken
    );
  }

  const modelMap: Record<string, string> = {
    "gemini-1.5-pro": "gemini-3.1-pro",
    "gemini-1.5-flash": "gemini-2.0-flash",
    "gemini-2.5-flash": "gemini-2.0-flash",
  };
  modelToUse = modelMap[modelToUse] || modelToUse;

  const creditCost = getModelCreditCost(requestedModel || "auto", !!generateImage);
  
  // Quota check: only for free models (cost 0)
  const usageKey = `ai_usage:${user.email}`;
  if (creditCost === 0) {
    const currentUsage = await kv.get<number>(usageKey) || 0;
    const LIMIT = 100;
    if (currentUsage >= LIMIT) return NextResponse.json({ error: "Daily quota exceeded for free models" }, { status: 403 });
  }

  if (creditCost > 0) {
    const userCredits = await kv.get<number>(creditsKey(user.email)) ?? 0;
    if (userCredits < creditCost) return NextResponse.json({ error: "Insufficient credits", needTopup: true }, { status: 402 });
    await kv.set(creditsKey(user.email), userCredits - creditCost);
  }

  let quizContext = "";
  if (!canvasMode) {
    const courses = await getAllCoursesWithCustom();
    quizContext = courses.flatMap(c => c.quizzes.map(q => `## ${c.title} > ${q.title}\n${q.questions.map((qu, idx) => `Q${idx+1}: ${qu.text}`).join("\n")}`)).join("\n\n").slice(0, 15000);
  }

  const systemInstruction = `คุณคือ Allquiz AI ผู้ช่วยอัจฉริยะ 
- ตอบเป็นภาษา${language === "en" ? "อังกฤษ" : "ไทย"}
- ทุกครั้งที่ตอบ ให้เริ่มด้วย <think> ... </think> ครอบกระบวนการคิดวิเคราะห์
- หากผู้ใช้ขอให้สร้างโค้ดหรือเอกสารยาวๆ ให้ใช้รูปแบบ <canvas type="TYPE" title="TITLE">เนื้อหา</canvas>
${customInstructions ? `\nข้อมูลจากผู้ใช้: ${customInstructions}` : ""}
${memoryEnabled ? "\n(Memory reference enabled)" : ""}
\nข้อมูลบทเรียนประกอบ: ${quizContext}`;

  const encoder = new TextEncoder();
  const modelsToTry = [modelToUse];
  if (thaillmApiKey && !modelsToTry.includes("thaillm/typhoon-v1.5x-70b-instruct")) modelsToTry.push("thaillm/typhoon-v1.5x-70b-instruct");
  if (groqApiKey && !modelsToTry.includes("groq/llama-3.3-70b-versatile")) modelsToTry.push("groq/llama-3.3-70b-versatile");
  if (geminiApiKey && !modelsToTry.includes("gemini-2.0-flash")) modelsToTry.push("gemini-2.0-flash");
  if (openRouterApiKey && !modelsToTry.includes("openrouter/google/gemini-2.0-flash")) modelsToTry.push("openrouter/google/gemini-2.0-flash");

  const stream = new ReadableStream({
    async start(controller) {
      const uniqueModels = [...new Set(modelsToTry)];
      let currentFailingModel = "";

      for (let i = 0; i < uniqueModels.length; i++) {
        const m = uniqueModels[i];
        if (i > 0) {
          const failingName = currentFailingModel.split("/").pop() || "ก่อนหน้า";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            status: "switching", 
            model: m,
            message: `โมเดล ${failingName} ไม่พร้อมใช้งาน กำลังสลับไปใช้ ${m.split("/").pop()}...` 
          })}\n\n`));
        }
        currentFailingModel = m;

        try {
          let res: Response | null = null;
          const commonMsgs = truncatedMessages.map((msg: { role: string; content: string }) => ({ role: msg.role === "user" ? "user" : "assistant", content: msg.content }));
          
          if (m.startsWith("thaillm/")) {
            res = await fetch("http://thaillm.or.th/api/openthaigpt/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": thaillmApiKey! },
              body: JSON.stringify({ model: "/model", messages: [{role:"system", content: systemInstruction}, ...commonMsgs], stream: true }),
            });
          } else if (m.startsWith("groq/")) {
            res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
              body: JSON.stringify({ model: m.replace("groq/", ""), messages: [{role:"system", content: systemInstruction}, ...commonMsgs], stream: true }),
            });
          } else if (m.startsWith("github/")) {
            res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${githubToken}` },
              body: JSON.stringify({ model: m.replace("github/", ""), messages: [{role:"system", content: systemInstruction}, ...commonMsgs], stream: true }),
            });
          } else if (m.startsWith("openrouter/")) {
            res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openRouterApiKey}` },
              body: JSON.stringify({ model: m.replace("openrouter/", ""), messages: [{role:"system", content: systemInstruction}, ...commonMsgs], stream: true }),
            });
          } else if (m.startsWith("claude-")) {
            res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": claudeApiKey!, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({ model: m, max_tokens: 4096, system: systemInstruction, messages: commonMsgs, stream: true }),
            });
          } else {
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${geminiApiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: truncatedMessages.map((msg: { role: string; content: string }) => ({ role: msg.role === "user" ? "user" : "model", parts: [{ text: msg.content }] })) }),
            });
          }

          if (res && res.ok) {
            const reader = res.body?.getReader();
            if (!reader) continue;
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                let text = "";
                try {
                  if (trimmed.startsWith("data: ")) {
                    const jsonStr = trimmed.slice(6);
                    if (jsonStr === "[DONE]") continue;
                    const parsed = JSON.parse(jsonStr);
                    text = parsed.choices?.[0]?.delta?.content || 
                           parsed.candidates?.[0]?.content?.parts?.[0]?.text ||
                           parsed.delta?.text || 
                           parsed.text || "";
                  } else if (trimmed.startsWith("{")) {
                    const parsed = JSON.parse(trimmed);
                    text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  }
                  if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                } catch {}
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            if (creditCost === 0) {
              await kv.incr(usageKey);
              await kv.expire(usageKey, secondsUntilMidnight());
            }
            controller.close();
            return;
          }
        } catch (e) { console.error(`Error with ${m}:`, e); }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "AI service is currently unavailable", allFailed: true })}\n\n`));
      controller.close();
    }
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
