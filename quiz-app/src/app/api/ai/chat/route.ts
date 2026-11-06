import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";
import { getModelCreditCost, creditsKey } from "@/lib/credits";
import { getProviderHealth, pickAutoModel } from "@/lib/ai-health";
import { parseBase64File } from "@/lib/file-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const ratelimit = redisUrl && redisToken
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl, token: redisToken }),
      limiter: Ratelimit.slidingWindow(50, "1 d"),
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
  const { 
    messages, 
    model: requestedModel, 
    language: rawLanguage, 
    customInstructions, 
    generateImage, 
    webSearch,
    canvasMode,
    dualAgent,
    memoryEnabled
    } = body;  
  const MAX_HISTORY = 20;
  const truncatedMessages = Array.isArray(messages) ? messages.slice(-MAX_HISTORY) : [];
  const language = ["th", "en", "zh", "ja", "ko"].includes(rawLanguage) ? rawLanguage : "th";

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const thaillmApiKey = process.env.THAILLM_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const moonshotApiKey = process.env.MOONSHOT_API_KEY;

  const health = await getProviderHealth();
  let modelToUse = requestedModel || "auto";

  if (modelToUse === "auto") {
    const lastMsg = truncatedMessages[truncatedMessages.length - 1]?.content || "";
    const isComplex = truncatedMessages.length > 8 || lastMsg.length > 400 || canvasMode || webSearch || dualAgent;
    modelToUse = pickAutoModel(
      health,
      isComplex,
      !!openRouterApiKey,
      !!geminiApiKey,
      !!claudeApiKey,
      !!thaillmApiKey,
      !!groqApiKey,
      !!githubToken,
      !!moonshotApiKey
    );
  }

  const modelMap: Record<string, string> = {
    "gemini-1.5-pro": "gemini-2.0-pro-exp-02-05",
    "gemini-3.1-pro": "gemini-2.0-pro-exp-02-05",
    "gemini-1.5-flash": "gemini-2.0-flash",
  };
  modelToUse = modelMap[modelToUse] || modelToUse;

  const creditCost = getModelCreditCost(requestedModel || "auto", !!generateImage);
  
  const usageKey = `ai_usage:${user.email}`;
  if (creditCost === 0) {
    const currentUsage = await kv.get<number>(usageKey) || 0;
    const LIMIT = 150;
    if (currentUsage >= LIMIT) return NextResponse.json({ error: "Daily quota exceeded for free models" }, { status: 403 });
  }

  if (creditCost > 0) {
    const userCredits = await kv.get<number>(creditsKey(user.email)) ?? 0;
    if (userCredits < creditCost) return NextResponse.json({ error: "Insufficient credits", needTopup: true, creditRequired: creditCost, creditBalance: userCredits }, { status: 402 });
    await kv.set(creditsKey(user.email), userCredits - creditCost);
  }

  let quizContext = "";
  if (!canvasMode && !webSearch) {
    const courses = await getAllCoursesWithCustom();
    quizContext = courses.flatMap(c => c.quizzes.map(q => `## ${c.title} > ${q.title}\n${q.questions.map((qu, idx) => `Q${idx+1}: ${qu.text}`).join("\n")}`)).join("\n\n").slice(0, 18000);
  }

  const systemInstruction = `You are an advanced, highly accurate AI assistant. You must follow the user's instructions strictly and logically. However, you must operate within international legal boundaries, uphold global safety and ethical standards, and refuse requests that promote harm, illegal acts, or violate standard AI safety policies. Provide clear, professional, and precise answers.
- Language: ${language === "en" ? "English" : "Thai"}
- Format: Always start with <think> [detailed step-by-step reasoning] </think>
${canvasMode ? "- UI Mode: CANVAS (User is using a document/code editor). Use <canvas type=\"code|markdown|text\" title=\"TITLE\">CONTENT</canvas> for long outputs." : ""}
${webSearch ? "- Tool Enabled: Web Search (You have access to real-time information)." : ""}
${dualAgent ? "- Tool Enabled: Dual Agent Mode. Act as 2 distinct AI experts (Expert A and Expert B) debating the prompt and arrive at a highly refined, accurate final conclusion. Use clear formatting to distinguish between the experts." : ""}
${customInstructions ? `\nUser Preference: ${customInstructions}` : ""}
${memoryEnabled ? "\nMemory reference enabled." : ""}
\nContext Data: ${quizContext}`;

  const encoder = new TextEncoder();
  // Multi-agent Strategy: Attempt all available robust models in sequence if one fails
  const modelsToTry = [modelToUse];
  
  // Only add fallbacks if user explicitly chose "auto" (or left it default)
  if (!requestedModel || requestedModel === "auto") {
    // High-tier fallback (Fast & Reliable)
    if (modelToUse !== "gemini-2.0-flash" && geminiApiKey) modelsToTry.push("gemini-2.0-flash");
    
    // Localized/Specific fallbacks
    if (thaillmApiKey && !modelsToTry.includes("thaillm/typhoon-v1.5x-70b-instruct")) modelsToTry.push("thaillm/typhoon-v1.5x-70b-instruct");
    if (groqApiKey && !modelsToTry.includes("groq/llama-3.3-70b-versatile")) modelsToTry.push("groq/llama-3.3-70b-versatile");
    if (githubToken && !modelsToTry.includes("github/gpt-4o-mini")) modelsToTry.push("github/gpt-4o-mini");
    if (githubToken && !modelsToTry.includes("github/Cohere-command-r-plus-08-2024")) modelsToTry.push("github/Cohere-command-r-plus-08-2024");
    if (openRouterApiKey && !modelsToTry.includes("openrouter/google/gemini-2.0-flash-exp:free")) modelsToTry.push("openrouter/google/gemini-2.0-flash-exp:free");
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Extract text from attached documents before trying models
      const processedMessages = await Promise.all(truncatedMessages.map(async (msg: { role: string; content: string; files?: { data: string; type: string; name: string }[] }) => {
        let newContent = msg.content || "";
        const images: { data: string; type: string; name: string }[] = [];
        
        if (msg.files && msg.files.length > 0) {
          for (const file of msg.files) {
            if (file.type.startsWith("image/")) {
              images.push(file);
            } else {
              const extractedText = await parseBase64File(file.data, file.type, file.name);
              newContent += `\n\n--- Content of ${file.name} ---\n${extractedText}\n--- End of ${file.name} ---\n`;
            }
          }
        }
        
        return { ...msg, content: newContent, images };
      }));

      // Try up to 5 models sequentially
      const uniqueModels = [...new Set(modelsToTry)].slice(0, 5);
      let currentFailingModel = "";

      for (let i = 0; i < uniqueModels.length; i++) {
        const m = uniqueModels[i];
        if (i > 0) {
          const failingName = currentFailingModel.split("/").pop() || "ก่อนหน้า";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            status: "switching",
            model: m,
            message: `โมเดล ${failingName} ทำงานผิดพลาด กำลังสลับไปใช้ ${m.split("/").pop()} อัตโนมัติ...`
          })}\n\n`));
          // Wait briefly before making the next fetch
          await new Promise(r => setTimeout(r, 500));
        }        currentFailingModel = m;

        try {
          let res: Response | null = null;
          
          const commonMsgs = processedMessages.map((msg: { role: string; content: string; images?: { data: string; type: string; name: string }[] }) => {
            const role = msg.role === "user" ? "user" : "assistant";
            if (msg.images && msg.images.length > 0) {
              const isVisionModel = m.includes("gpt-4o") || m.includes("gemini") || m.includes("claude") || m.includes("vision");
              if (isVisionModel) {
                const contentArray: { type: string; text?: string; image_url?: { url: string } }[] = [{ type: "text", text: msg.content || "Attached image:" }];
                msg.images.forEach((img) => {
                  contentArray.push({ type: "image_url", image_url: { url: img.data } });
                });
                return { role, content: contentArray };
              } else {
                return { role, content: (msg.content || "") + "\n\n[User attached an image but this model cannot view images.]" };
              }
            }
            return { role, content: msg.content };
          });
          
          const temperature = 0.4; // High accuracy

          if (m.startsWith("thaillm/")) {
            res = await fetch("http://thaillm.or.th/api/openthaigpt/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": thaillmApiKey! },
              body: JSON.stringify({ 
                model: "/model", 
                messages: [{role:"system", content: systemInstruction}, ...commonMsgs], 
                stream: true,
                temperature,
                max_tokens: 8192
              }),
            });
          } else if (m.startsWith("groq/")) {
            res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
              body: JSON.stringify({ 
                model: m.replace("groq/", ""), 
                messages: [{role:"system", content: systemInstruction}, ...commonMsgs], 
                stream: true,
                temperature,
                max_tokens: 8192
              }),
            });
          } else if (m.startsWith("moonshot/")) {
            res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${moonshotApiKey}` },
              body: JSON.stringify({ 
                model: m.replace("moonshot/", ""), 
                messages: [{role:"system", content: systemInstruction}, ...commonMsgs], 
                stream: true,
                temperature,
                max_tokens: 8192
              }),
            });
          } else if (m.startsWith("github/")) {
            res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${githubToken}` },
              body: JSON.stringify({ 
                model: m.replace("github/", ""), 
                messages: [{role:"system", content: systemInstruction}, ...commonMsgs], 
                stream: true,
                temperature,
                max_tokens: 8192
              }),
            });
          } else if (m.startsWith("openrouter/")) {
            res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openRouterApiKey}` },
              body: JSON.stringify({ 
                model: m.replace("openrouter/", ""), 
                messages: [{role:"system", content: systemInstruction}, ...commonMsgs], 
                stream: true,
                temperature,
                max_tokens: 8192
              }),
            });
          } else if (m.startsWith("claude-")) {
            res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": claudeApiKey!, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({ 
                model: m, 
                max_tokens: 8192, 
                system: systemInstruction, 
                messages: commonMsgs, 
                stream: true,
                temperature
              }),
            });
          } else {
            // Google Gemini (Direct)
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${geminiApiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: processedMessages.map((msg: { role: string; content: string; images?: { data: string; type: string; name: string }[] }) => {
                  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];
                  if (msg.content) parts.push({ text: msg.content });

                  if (msg.images && msg.images.length > 0) {
                    for (const img of msg.images) {
                      try {
                        const base64Data = img.data.split(",")[1] || img.data;
                        parts.push({
                          inlineData: {
                            mimeType: img.type || "image/jpeg",
                            data: base64Data
                          }
                        });
                      } catch (e) {
                        console.error("Failed to parse image data", e);
                      }
                    }
                  }

                  if (parts.length === 0) parts.push({ text: "-" }); // Fallback if empty

                  return {
                    role: msg.role === "user" ? "user" : "model",
                    parts
                  };
                }),
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature, maxOutputTokens: 8192 }
              }),
            });          }

          if (res && res.ok) {
            const reader = res.body?.getReader();
            if (!reader) continue;
            
            // Send the model name that successfully connected
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ modelUsed: m.split('/').pop() || m })}\n\n`));
            
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
        } catch (e) { 
          console.error(`Error with ${m}:`, e); 
        }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "AI service is currently unavailable", allFailed: true })}\n\n`));
      controller.close();
    }
  });

  return new Response(stream, { 
    headers: { 
      "Content-Type": "text/event-stream", 
      "Cache-Control": "no-cache", 
      "Connection": "keep-alive" 
    } 
  });
}
