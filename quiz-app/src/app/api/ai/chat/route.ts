import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";
import { getModelCreditCost, addCreditLog, creditsKey } from "@/lib/credits";
import { getProviderHealth, pickAutoModel } from "@/lib/ai-health";
import { webSearchWithContent } from "@/lib/web-search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Initialize Ratelimit (only when Redis env vars are available)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = redisUrl && redisToken
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl, token: redisToken }),
      limiter: Ratelimit.slidingWindow(20, "1 d"),
      analytics: true,
    })
  : null;


// Calculate seconds until midnight (Bangkok time) for quota TTL
function secondsUntilMidnight(): number {
  const now = new Date();
  const bangkokNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const tomorrow = new Date(bangkokNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.max(Math.ceil((tomorrow.getTime() - bangkokNow.getTime()) / 1000), 60);
}

export async function POST(request: NextRequest) {
  // 0. API Rate Limiting (Phase 3)
  if (ratelimit) {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again tomorrow." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          }
        }
      );
    }
  }

  // 1. Check Authentication
  const userToken = request.cookies.get("user-session")?.value;
  const adminToken = request.cookies.get("admin-session")?.value;
  const token = userToken || adminToken;
  
  if (!isValidSession(token)) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบเพื่อใช้งาน AI Chat" },
      { status: 401 }
    );
  }

  const user = getSessionInfo(token);
  if (!user?.email) {
    return NextResponse.json(
      { error: "ไม่พบข้อมูลผู้ใช้" },
      { status: 401 }
    );
  }

  // 2. Check Quota (Limit to 100 uses per day)
  const usageKey = `ai_usage:${user.email}`;
  const currentUsage = await kv.get<number>(usageKey) || 0;
  const LIMIT = 100;

  if (currentUsage >= LIMIT) {
    // Calculate time until midnight for reset info
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const hoursLeft = Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60));
    const resetTime = tomorrow.toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
    return NextResponse.json(
      { error: `คุณใช้งานครบโควตา ${LIMIT} ครั้งแล้ว จะใช้ได้อีกครั้งในอีก ~${hoursLeft} ชั่วโมง (เที่ยงคืน ${resetTime} น.)` },
      { status: 403 }
    );
  }

  
  // 2.5 Token Usage Optimization: History Truncation (Phase 3)
  // Keep the 15 most recent messages to stay within token limits and save costs
  const MAX_HISTORY = 15;

  const body = await request.json();
  const { messages, model: requestedModel, responseStyle, language: rawLanguage, webSearch, generateImage, canvasMode, memoryEnabled } = body;

  // Server-side validation
  const ALLOWED_LANGUAGES = ["th", "en", "zh", "ja", "ko"];
  const language = ALLOWED_LANGUAGES.includes(rawLanguage) ? rawLanguage : "th";

  // Sanitize customInstructions: max 500 chars, strip control chars
  const rawInstructions = typeof body.customInstructions === "string" ? body.customInstructions : "";
  const customInstructions = rawInstructions.slice(0, 500).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // Validate model against allowlist
  const ALLOWED_MODELS = [
    "auto", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.1-pro", "claude-sonnet",
    "openrouter/google/gemini-2.5-flash", "openrouter/google/gemini-2.5-pro-preview",
    "openrouter/google/gemini-3-flash-preview", "openrouter/meta-llama/llama-4-maverick",
    "openrouter/meta-llama/llama-4-scout", "openrouter/openai/gpt-4.1",
    "openrouter/openai/gpt-4.1-mini", "openrouter/openai/o4-mini",
    "openrouter/deepseek/deepseek-r1",
  ];
  if (requestedModel && !ALLOWED_MODELS.includes(requestedModel)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  }

  let truncatedMessages = messages;
  if (messages.length > MAX_HISTORY) {
    truncatedMessages = messages.slice(-MAX_HISTORY);
    console.log(`[Security] Truncated conversation from ${messages.length} to ${truncatedMessages.length} messages.`);
  }

  // Validate file sizes in messages (max 4MB per file)
  const MAX_FILE_SIZE = 4 * 1024 * 1024;
  for (const msg of truncatedMessages) {
    if (msg.files && Array.isArray(msg.files)) {
      msg.files = msg.files.filter((f: { data?: string }) => {
        if (!f.data) return true;
        // Base64 string length * 0.75 ≈ actual bytes
        return f.data.length * 0.75 <= MAX_FILE_SIZE;
      }).slice(0, 5); // Max 5 files per message
    }
  }


  // Check API keys based on model
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  console.log("[AI Chat] Model requested:", requestedModel, "| GEMINI key:", geminiApiKey ? "YES" : "NO", "| ANTHROPIC key:", claudeApiKey ? "YES" : "NO", "| OPENROUTER key:", openRouterApiKey ? "YES" : "NO");

  const requestedIsClaudeRaw = (requestedModel || "").startsWith("claude-");
  const requestedIsOpenRouter = (requestedModel || "").startsWith("openrouter/");
  if (!geminiApiKey && !requestedIsClaudeRaw && !requestedIsOpenRouter) {
    console.error("[Config Error] GEMINI_API_KEY is not configured");
    return NextResponse.json(
      { error: "ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ" },
      { status: 500 }
    );
  }
  if (requestedIsClaudeRaw && !claudeApiKey) {
    console.error("[Config Error] ANTHROPIC_API_KEY is not configured");
    return NextResponse.json(
      { error: "โมเดลนี้ไม่พร้อมใช้งาน กรุณาเปลี่ยนเป็นโมเดลอื่น" },
      { status: 500 }
    );
  }
  if (requestedIsOpenRouter && !openRouterApiKey) {
    console.error("[Config Error] OPENROUTER_API_KEY is not configured");
    return NextResponse.json(
      { error: "OpenRouter API Key ยังไม่ได้ตั้งค่า กรุณาเพิ่ม OPENROUTER_API_KEY ใน .env.local" },
      { status: 500 }
    );
  }
  const apiKey = geminiApiKey || "";

  // 3. Determine Model — Smart Auto Selection
  let modelToUse = requestedModel || "auto";
  const hasFile = truncatedMessages.some((m: any) => m.files && m.files.length > 0);
  const lastUserMsg = truncatedMessages[truncatedMessages.length - 1]?.content || "";
  const msgLength = lastUserMsg.length;

  if (modelToUse === "auto") {
    // Detect task complexity
    const isCodeTask = /(?:สร้าง|เขียน|code|create|build|debug|fix|แก้|โค้ด|react|html|python|javascript)/i.test(lastUserMsg);
    const isAnalysis = /(?:วิเคราะห์|สรุป|อธิบาย|explain|analyze|summarize|compare|เปรียบเทียบ)/i.test(lastUserMsg);
    const isComplex = hasFile || messages.length > 10 || msgLength > 500 || isCodeTask || isAnalysis || canvasMode;

    // Use cached health check to know which providers actually work right now
    const health = await getProviderHealth();
    modelToUse = pickAutoModel(health, isComplex, !!openRouterApiKey, !!geminiApiKey, !!claudeApiKey);

    console.log(`[Auto] Complexity: ${isComplex ? "HIGH" : "NORMAL"} | Health: gemini=${health.gemini} claude=${health.claude} openrouter=${health.openrouter} (credits: ${health.openrouterCredits}) → Model: ${modelToUse}`);
  }

  // Check model type
  const isClaudeModel = modelToUse.startsWith("claude-");
  const isOpenRouterModel = modelToUse.startsWith("openrouter/");

  // Map any legacy model names (for Gemini/Claude)
  if (!isOpenRouterModel) {
    const modelMap: Record<string, string> = {
      "gemini-1.5-pro": "gemini-3.1-pro",
      "gemini-1.5-flash": "gemini-2.5-flash",
      "gemini-2.0-flash": "gemini-2.5-flash",
      "gemini-2.5-flash": "gemini-2.5-flash",
      "gemini-3.1-pro": "gemini-3.1-pro",
      "claude-opus-4.6": "claude-opus-4-6",
      "claude-sonnet": "claude-sonnet-4-6",
    };
    modelToUse = modelMap[modelToUse] || (isClaudeModel ? "claude-sonnet-4-6" : "gemini-2.5-flash");
  }

  // 3. Check Credits for pro models
  const creditCost = getModelCreditCost(requestedModel || "auto", !!generateImage);
  if (creditCost > 0) {
    const userCredits = await kv.get<number>(creditsKey(user.email)) ?? 0;
    if (userCredits < creditCost) {
      return NextResponse.json(
        {
          error: `เครดิตไม่เพียงพอ — โมเดลนี้ใช้ ${creditCost} เครดิต (คงเหลือ ${userCredits})`,
          creditRequired: creditCost,
          creditBalance: userCredits,
          needTopup: true,
        },
        { status: 402 }
      );
    }
    // Deduct credits
    const newBalance = userCredits - creditCost;
    await kv.set(creditsKey(user.email), newBalance);
    await addCreditLog(user.email, {
      amount: -creditCost,
      type: "usage",
      description: `ใช้งาน ${requestedModel || modelToUse}${generateImage ? " (สร้างรูปภาพ)" : ""}`,
      model: requestedModel || modelToUse,
      balanceAfter: newBalance,
    });
    console.log(`[Credits] ${user.email}: -${creditCost} credits (${newBalance} remaining) for ${requestedModel || modelToUse}`);
  }

  // Load user memories if enabled
  let memoryContext = "";
  if (memoryEnabled !== false) {
    try {
      const memoryKey = `ai_memories:${user.email}`;
      const raw = await kv.get(memoryKey);
      if (raw) {
        // kv.get may return already-parsed object or a string
        const memoryItems: { content: string }[] = typeof raw === "string" ? JSON.parse(raw) : (raw as { content: string }[]);
        if (Array.isArray(memoryItems) && memoryItems.length > 0) {
          memoryContext = `\n\nข้อมูลที่จดจำเกี่ยวกับผู้ใช้ (Memory):\n${memoryItems.map(m => `- ${m.content}`).join("\n")}`;
        }
      }
    } catch (e) {
      console.warn("[Memory Load Error]", e);
    }
  }

  // Build quiz context for AI (skip for canvas mode - not needed for code generation)
  let quizContext = "";
  if (!canvasMode) {
    const courses = await getAllCoursesWithCustom();
    let contextParts: string[] = [];

    for (const course of courses) {
      for (const quiz of course.quizzes) {
        if (quiz.type === "pdf" || quiz.questions.length === 0) continue;

        const qaPairs = quiz.questions.map((q, i) => {
          const correct = q.choices.find((c) => c.isCorrect);
          const choiceList = q.choices
            .map((c) => `  ${c.isCorrect ? "✓" : "✗"} ${c.text}`)
            .join("\n");
          return `ข้อ ${i + 1}: ${q.text}\n${choiceList}\nคำตอบที่ถูกต้อง: ${correct?.text ?? "ไม่ระบุ"}`;
        });

        contextParts.push(
          `## ${course.title} > ${quiz.title}\n${qaPairs.join("\n\n")}`
        );
      }
    }

    // Limit context size to avoid exceeding token limits
    quizContext = contextParts.join("\n\n---\n\n");
    if (quizContext.length > 60000) {
      quizContext = quizContext.slice(0, 60000) + "\n\n[...ข้อมูลถูกตัดบางส่วนเนื่องจากข้อจำกัดขนาด]";
    }
  }

  // === Web Search: fetch real results and inject into context ===
  let webSearchContext = "";
  let webSearchSources: { title: string; url: string }[] = [];
  if (webSearch) {
    try {
      // Derive search query from the last user message
      const searchQuery = lastUserMsg.length > 200 ? lastUserMsg.slice(0, 200) : lastUserMsg;
      console.log(`[WebSearch] Query: "${searchQuery.slice(0, 80)}..."`);

      const { results, context } = await webSearchWithContent(searchQuery);
      if (context) {
        webSearchContext = `\n\n=== ข้อมูลจากการค้นหาเว็บ (Web Search Results) ===\n${context}\n=== จบข้อมูลจากเว็บ ===\n\nคำแนะนำ: ใช้ข้อมูลจากเว็บด้านบนเพื่อตอบคำถามอย่างถูกต้องและอ้างอิงแหล่งที่มา ระบุ URL เมื่ออ้างอิงข้อมูล`;
        webSearchSources = results.map(r => ({ title: r.title, url: r.url }));
        console.log(`[WebSearch] Got ${results.length} results with content`);
      }
    } catch (err) {
      console.warn("[WebSearch] Error:", err);
    }
  }

  // Build response style instruction
  const styleInstruction = responseStyle === "detailed"
    ? "\n- ตอบอย่างละเอียด มีตัวอย่างประกอบ อธิบายเพิ่มเติมให้เข้าใจ"
    : "\n- ตอบกระชับ ตรงประเด็น ไม่ยืดยาว";

  // Model-specific thinking depth
  const isProModel = modelToUse.includes("pro") || modelToUse.includes("opus");
  const isFlashModel = modelToUse.includes("flash") || modelToUse.includes("sonnet");

  const thinkingInstruction = isProModel
    ? `\n\nระดับการวิเคราะห์: ละเอียดสูงสุด (Pro Model)
- คิดวิเคราะห์อย่างลึกซึ้ง พิจารณาทุกมุมมอง
- ใน <think> ให้วิเคราะห์แบบ step-by-step อย่างละเอียด:
  ขั้นตอนที่ 1: ทำความเข้าใจคำถาม — สิ่งที่ผู้ใช้ถาม/ต้องการจริงๆ คืออะไร
  ขั้นตอนที่ 2: วิเคราะห์ — พิจารณาทุกตัวเลือก/มุมมอง ข้อดี-ข้อเสีย
  ขั้นตอนที่ 3: ตรวจสอบ — double-check ความถูกต้อง มีข้อยกเว้นหรือไม่
  ขั้นตอนที่ 4: สรุป — เลือกคำตอบที่ดีที่สุดพร้อมเหตุผล
- พิจารณาข้อยกเว้น กรณีพิเศษ และความเป็นไปได้ทุกทาง
- หากเป็นข้อสอบ ให้วิเคราะห์ทุกตัวเลือกว่าถูก/ผิดเพราะอะไร
- ห้ามพูดถึง [MEMORY_SAVE] ใน <think>`
    : isFlashModel
    ? `\n\nระดับการวิเคราะห์: รวดเร็วแม่นยำ (Flash Model)
- ห้ามใช้ <think> tags — ตอบโดยตรงทันที ไม่ต้องแสดงกระบวนการคิด
- เน้นความเร็วและความถูกต้อง ตอบตรงคำถาม ไม่อ้อมค้อม`
    : "";

  // Build custom instructions
  const customInstructionBlock = customInstructions
    ? `\n\nข้อมูลเพิ่มเติมจากผู้ใช้:\n${customInstructions}`
    : "";

  // Memory auto-save instruction
  const memoryInstruction = memoryEnabled !== false
    ? `\n\nระบบความทรงจำ (Memory):
- เมื่อผู้ใช้แจ้งข้อมูลสำคัญเกี่ยวกับตัวเอง (เช่น ชื่อ อาชีพ สาขาเรียน ความสนใจ ความชอบ สิ่งที่ไม่ชอบ) ให้บันทึกเป็นความทรงจำ
- วิธีบันทึก: เพิ่ม [MEMORY_SAVE: ข้อความ] ไว้ท้ายสุดของคำตอบ (หลัง </think> เสมอ ห้ามใส่ใน <think>)
- ตัวอย่าง: ผู้ใช้บอก "ผมชื่อเกม" → ตอบปกติ แล้วเพิ่มท้ายสุด: [MEMORY_SAVE: ผู้ใช้ชื่อเกม]
- ตัวอย่าง: ผู้ใช้บอก "ฉันเรียนวิศวกรรมซอฟต์แวร์ ปี 3" → [MEMORY_SAVE: ผู้ใช้เป็นนักศึกษาปี 3 สาขาวิศวกรรมซอฟต์แวร์]
- บันทึกเฉพาะข้อมูลส่วนตัวที่สำคัญ ไม่ต้องบันทึกคำถามทั่วไป
- สำคัญมาก: ห้ามพูดถึง MEMORY_SAVE ใน <think> และห้ามบอกผู้ใช้ว่ากำลังบันทึก ให้ทำอย่างเงียบๆ
- ห้ามใส่ [MEMORY_SAVE:] ใน <think> tags โดยเด็ดขาด${memoryContext}`
    : memoryContext;

  const systemInstruction = canvasMode
    ? `คุณคือ Allquiz AI Canvas — ผู้เชี่ยวชาญสร้างเว็บไซต์, แอป React, เอกสาร และโค้ดทุกภาษา

## กฎที่สำคัญที่สุด — ใช้ <canvas> tags เสมอ
ทุกครั้งที่สร้างโค้ดหรือเอกสาร ต้องใส่ใน <canvas> tags เท่านั้น ห้ามใช้ \`\`\` code blocks

รูปแบบ:
<canvas type="TYPE" title="TITLE">
โค้ดหรือเนื้อหาทั้งหมดที่นี่
</canvas>

## ประเภท type ที่รองรับ:
- "react" — สำหรับ React components (ใช้ TSX, export default function App)
- "nextjs" — สำหรับ Next.js pages/components
- "html" — สำหรับ HTML/CSS/JS (ไฟล์ HTML เดียวที่สมบูรณ์ พร้อม <style> และ <script>)
- "document" — สำหรับเอกสาร (Markdown format)
- "code" — สำหรับโค้ดภาษาอื่นๆ (Python, Node.js, SQL, etc.)

## ตัวอย่าง:

ผู้ใช้: "สร้างเว็บพอร์ตโฟลิโอ"
ตอบ: สร้างเว็บพอร์ตโฟลิโอให้เลยครับ

<canvas type="html" title="Portfolio Website">
<!DOCTYPE html>
<html>...โค้ดทั้งหมด...</html>
</canvas>

ผู้ใช้: "สร้าง Todo App"
ตอบ: สร้าง Todo App ด้วย React ให้เลยครับ

<canvas type="react" title="Todo App">
import React, { useState } from 'react';
export default function App() { ... }
</canvas>

## กฎเพิ่มเติม:
- ห้ามใช้ <think> tags ห้ามคิดวิเคราะห์ยาว ให้ตอบสั้นๆ 1 บรรทัดแล้วเริ่มเขียนโค้ดทันที
- โค้ดต้องสมบูรณ์ ใช้งานได้จริง ออกแบบสวยงาม responsive
- สำหรับ HTML: ใช้ Tailwind CDN, Google Fonts (Kanit สำหรับไทย), gradient, shadow, animation
- สำหรับ React: export default function App() เป็น entry point, ใช้ lucide-react สำหรับ icons
- ห้ามใส่โค้ดใน \`\`\`markdown code blocks\`\`\` ให้ใส่ใน <canvas> เท่านั้น
- ตอบเป็นภาษา${language === "en" ? "อังกฤษ" : language === "zh" ? "จีน" : language === "ja" ? "ญี่ปุ่น" : language === "ko" ? "เกาหลี" : "ไทย"}
${customInstructionBlock}${memoryInstruction}`
    : `คุณคือ Allquiz AI ผู้ช่วยอัจฉริยะที่ทำได้ทุกอย่าง

หน้าที่ของคุณ:
1. ตอบคำถามทุกประเภท ทั้งข้อสอบ ความรู้ทั่วไป วิทยาศาสตร์ เทคโนโลยี ธุรกิจ ชีวิตประจำวัน ฯลฯ
2. สร้างไฟล์ตามที่ผู้ใช้ต้องการ - เขียนโค้ด สร้างเอกสาร สร้างข้อมูล สร้างตาราง สร้าง CSV/JSON/HTML
3. ช่วยตรวจสอบคำตอบข้อสอบ อธิบายเหตุผล
4. สรุปเนื้อหา วิเคราะห์ข้อมูล
5. วิเคราะห์ไฟล์และรูปภาพที่ผู้ใช้อัปโหลด
6. เขียนโค้ดทุกภาษา (Python, JavaScript, HTML, CSS, SQL, etc.)
7. สร้างเนื้อหา บทความ รายงาน จดหมาย ฯลฯ${customInstructionBlock}

การสร้างไฟล์:
- เมื่อผู้ใช้ขอให้สร้างไฟล์ ให้สร้างเนื้อหาครบถ้วนใน code block ที่เหมาะสม
- ตัวอย่าง: ขอไฟล์ CSV → ใส่ใน \`\`\`csv ... \`\`\` , ขอ HTML → ใส่ใน \`\`\`html ... \`\`\`
- ขอ Python → ใส่ใน \`\`\`python ... \`\`\` , ขอ JSON → ใส่ใน \`\`\`json ... \`\`\`
- สร้างเนื้อหาให้สมบูรณ์ มีข้อมูลจริง ใช้งานได้ทันที
- ผู้ใช้จะสามารถดาวน์โหลดไฟล์จาก code block ได้โดยอัตโนมัติ

การสร้างไฟล์ PDF และ Word:
- เมื่อผู้ใช้ขอสร้างไฟล์ PDF หรือ Word ระบบจะสร้างไฟล์ให้อัตโนมัติจากเนื้อหาที่คุณตอบ
- สำคัญมาก: เขียนเฉพาะเนื้อหาสำหรับเอกสารเท่านั้น ห้ามพูดคุย ห้ามอธิบาย ห้ามบอกว่า "ครับ" "ค่ะ" "นี่คือ" "ฉันจะสร้าง" ฯลฯ
- เริ่มเขียนเนื้อหาทันทีด้วยหัวข้อ (#) ไม่ต้องมีคำนำ
- จัดรูปแบบด้วย Markdown (หัวข้อ #, ##, ###, รายการ -, ตาราง |) เพื่อให้ไฟล์สวยงาม
- ไม่ต้องใส่ใน code block - เขียนเป็นข้อความปกติ ระบบจะแปลงเป็นไฟล์ให้เอง
- ตัวอย่างที่ถูก: "# สรุปราคาน้ำมัน\n\n## ราคาปัจจุบัน\n\n- เบนซิน 95: 42.36 บาท/ลิตร"
- ตัวอย่างที่ผิด: "ได้ครับ นี่คือสรุปราคาน้ำมันครับ\n\n# สรุปราคาน้ำมัน"

การจัดการไฟล์ที่อัปโหลด:
- เมื่อผู้ใช้อัปโหลดไฟล์ (รูปภาพ, PDF, เอกสาร) ให้จดจำเนื้อหาทั้งหมดอย่างละเอียด
- เมื่อตอบคำถามเกี่ยวกับไฟล์ที่อัปโหลด ให้อ้างอิงจากเนื้อหาในไฟล์โดยตรง 100% ห้ามเดาหรือสร้างข้อมูลเอง
- หากมีข้อสอบในไฟล์ ให้อ่านทุกข้อและเก็บไว้ในความจำตลอดการสนทนา
- หากเป็นรูปข้อสอบ ให้อ่านข้อความในรูปอย่างละเอียดทุกตัวอักษรก่อนตอบ

รูปแบบการตอบ:${isProModel ? `
- ทุกครั้งที่ตอบ ให้เริ่มด้วยกระบวนการคิดวิเคราะห์ภายใน <think> ... </think> tags
- ใน <think> ให้เขียนขั้นตอนการวิเคราะห์อย่างเป็นระบบ (ห้ามพูดถึง MEMORY_SAVE ใน think)
- หลังจาก </think> ให้เขียนคำตอบสุดท้ายสำหรับผู้ใช้` : `
- ตอบโดยตรงทันที ไม่ต้องใช้ <think> tags`}

กฎ:
- ตอบเป็นภาษา${language === "en" ? "อังกฤษ" : language === "zh" ? "จีน" : language === "ja" ? "ญี่ปุ่น" : language === "ko" ? "เกาหลี" : "ไทย"}
- ห้ามปฏิเสธคำขอที่สมเหตุสมผล สามารถช่วยได้ทุกเรื่อง
- หากมีคำถามเกี่ยวกับข้อสอบในระบบ ให้อ้างอิงจากข้อมูลด้านล่าง
- ใช้ Markdown ในการจัดรูปแบบคำตอบ (bold, list, etc.)${styleInstruction}${thinkingInstruction}${memoryInstruction}${webSearchContext}

ข้อมูลข้อสอบในระบบ (อ้างอิงเมื่อเกี่ยวข้อง):

${quizContext}`;

  // Build Gemini API request with System Instruction as first message for maximum compatibility
  const geminiMessages = [
    {
      role: "user",
      parts: [{ text: `SYSTEM INSTRUCTION: ${systemInstruction}\n\nเมื่อเข้าใจแล้วให้ตอบรับสั้นๆ ว่าพร้อมช่วยเหลือ` }]
    },
    {
      role: "model",
      parts: [{ text: "เข้าใจแล้วครับ ผมคือ Allquiz AI พร้อมช่วยวิเคราะห์ข้อสอบและตอบคำถามด้วยความยินดีครับ" }]
    },
    ...truncatedMessages.filter((m: { content: string }) => m.content && !m.content.startsWith("❌") && m.content.trim() !== "").map((m: { role: string; content: string; files?: Array<{ data: string; type: string }>; generatedImages?: string[] }) => {
      const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

      // Include user-uploaded files
      if (m.files && m.files.length > 0) {
        for (const file of m.files) {
          const match = file.data.match(/^data:(.+?);base64,(.+)$/);
          if (match) {
            parts.push({
              inline_data: {
                mime_type: match[1],
                data: match[2],
              },
            });
          }
        }
      }

      // Include AI-generated images (for refinement/editing)
      if (m.generatedImages && m.generatedImages.length > 0) {
        for (const img of m.generatedImages) {
          const match = img.match(/^data:(.+?);base64,(.+)$/);
          if (match) {
            parts.push({
              inline_data: {
                mime_type: match[1],
                data: match[2],
              },
            });
          }
        }
      }

      if (m.content) {
        parts.push({ text: m.content });
      }

      if (parts.length === 0) {
        parts.push({ text: "อธิบายข้อมูลนี้" });
      }

      return {
        role: m.role === "user" ? "user" : "model",
        parts,
      };
    })
  ];

  // Build request body with optional tools - adjust per model
  const geminiBody: Record<string, unknown> = {
    contents: geminiMessages,
    generationConfig: {
      temperature: isProModel ? 0.8 : 0.7,
      maxOutputTokens: isProModel ? 16384 : 8192,
      ...(isProModel ? { topP: 0.95, topK: 40 } : {}),
    },
    ...(isProModel && !canvasMode ? {
      // Pro model: enable thinking/reasoning budget
      generationConfig2: undefined, // Gemini handles this via thinkingConfig
    } : {}),
  };

  // Enable Google Search grounding when webSearch is requested
  if (webSearch) {
    geminiBody.tools = [{ google_search: {} }];
  }

  // === OPENROUTER API PATH ===
  // Skip OpenRouter for image generation — always use Gemini's image API
  if (isOpenRouterModel && openRouterApiKey && !generateImage) {
    // Extract actual model ID: "openrouter/google/gemini-2.5-pro-preview" → "google/gemini-2.5-pro-preview"
    const openRouterModelId = modelToUse.replace("openrouter/", "");
    console.log(`[OpenRouter] Using model: ${openRouterModelId}`);

    // Build OpenAI-compatible messages
    const orMessages = [
      { role: "system" as const, content: systemInstruction },
      ...truncatedMessages
        .filter((m: { role: string; content: string }) => m.content && !m.content.startsWith("❌") && m.content.trim() !== "")
        .map((m: { role: string; content: string; files?: Array<{ data: string; type: string }> }) => {
          // Handle image files as multimodal content
          if (m.files && m.files.length > 0) {
            const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
            for (const file of m.files) {
              if (file.data.startsWith("data:image/")) {
                parts.push({ type: "image_url", image_url: { url: file.data } });
              }
            }
            if (m.content) parts.push({ type: "text", text: m.content });
            return { role: m.role === "user" ? "user" as const : "assistant" as const, content: parts };
          }
          return { role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content };
        }),
    ];

    const orRequestBody = {
      model: openRouterModelId,
      messages: orMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 8192,
    };
    const orHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openRouterApiKey}`,
      "HTTP-Referer": "https://allquiz.app",
      "X-Title": "Allquiz AI",
    };

    let orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: orHeaders,
      body: JSON.stringify(orRequestBody),
    });

    // On 402 (no credits), retry with a free model before giving up
    if (orRes.status === 402 && openRouterModelId !== "google/gemini-2.5-flash") {
      console.warn(`[OpenRouter] 402 on ${openRouterModelId}, retrying with free model...`);
      const freeRetry = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: orHeaders,
        body: JSON.stringify({ ...orRequestBody, model: "google/gemini-2.5-flash" }),
      });
      if (freeRetry.ok) {
        console.log("[OpenRouter] Free model fallback succeeded");
        orRes = freeRetry;
      }
    }

    if (!orRes.ok) {
      const errText = await orRes.text();
      console.warn(`[OpenRouter Error] ${orRes.status}: ${errText.slice(0, 300)}`);
      console.log("[Fallback] OpenRouter failed, falling through to Claude/Gemini...");
      // Fall through to Claude/Gemini paths below
    } else {
      // OpenRouter succeeded — stream the response
      const orEncoder = new TextEncoder();
      const orStream = new ReadableStream({
        async start(controller) {
          // Send web search sources at stream start
          if (webSearchSources.length > 0) {
            controller.enqueue(orEncoder.encode(`data: ${JSON.stringify({ sources: webSearchSources })}\n\n`));
          }
          const reader = orRes.body?.getReader();
          if (!reader) { controller.close(); return; }
          const decoder = new TextDecoder();
          let buf = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const delta = parsed.choices?.[0]?.delta;
                  if (delta?.content) {
                    controller.enqueue(orEncoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                  }
                } catch {}
              }
            }
          }

          controller.enqueue(orEncoder.encode("data: [DONE]\n\n"));
          try { await kv.incr(usageKey); await kv.expire(usageKey, secondsUntilMidnight()); } catch {}
          controller.close();
        },
      });

      return new Response(orStream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }
  }

  // === IMAGE GENERATION ===
  if (generateImage) {
    // Step 1: Discover ALL available models and find image-capable ones
    let discoveredImageModels: string[] = [];
    let allModelNames: string[] = [];
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const models = (listData.models || []) as Array<{
          name: string;
          supportedGenerationMethods?: string[];
          description?: string;
          displayName?: string;
        }>;

        allModelNames = models.map((m) => m.name?.replace("models/", "") || "");

        // Find ANY model related to image generation
        discoveredImageModels = models
          .filter((m) => {
            const name = (m.name || "").toLowerCase();
            const desc = (m.description || "").toLowerCase();
            const display = (m.displayName || "").toLowerCase();
            return (
              name.includes("image") ||
              name.includes("imagen") ||
              desc.includes("image generation") ||
              display.includes("image")
            );
          })
          .map((m) => m.name?.replace("models/", "") || "");

        console.log(`Discovered ${models.length} models. Image models: ${discoveredImageModels.join(", ") || "none"}`);
      }
    } catch (err) {
      console.warn("Failed to list models:", err);
    }

    // Step 2: Build fallback list - discovered first, then known IDs
    // Prioritize newer models that are more likely to be available
    const knownImageModels = [
      "gemini-2.0-flash-preview-image-generation",
      "gemini-2.0-flash-exp-image-generation",
      "gemini-2.5-flash-preview-image-generation",
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash",
      "imagen-4.0-generate-001",
      "imagen-4.0-fast-generate-001",
      "imagen-4.0-ultra-generate-001",
      "imagen-3.0-generate-002",
      "imagen-3.0-fast-generate-001",
    ];
    // Put discovered models first, then known fallbacks
    const imageModels = [...discoveredImageModels, ...knownImageModels];
    // Dedupe
    const uniqueImageModels = [...new Set(imageModels)];

    let lastImgError = "";
    const lastUserMessage = truncatedMessages[truncatedMessages.length - 1]?.content || "generate an image";

    for (const imgModel of uniqueImageModels) {
      const isImagen = imgModel.startsWith("imagen");

      // Determine the correct API version and endpoint
      // Imagen 4.0+ and newer Gemini models may need v1beta or v1
      const apiVersion = "v1beta";
      const endpoint = isImagen ? "predict" : "generateContent";
      const imgUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${imgModel}:${endpoint}?key=${apiKey}`;

      let reqBody: Record<string, unknown>;
      if (isImagen) {
        reqBody = {
          instances: [{ prompt: lastUserMessage }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" },
        };
      } else {
        // Gemini image generation models
        reqBody = {
          contents: geminiMessages,
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            response_modalities: ["TEXT", "IMAGE"],
          },
        };
      }

      console.log(`Trying image model: ${imgModel} (${endpoint})`);

      try {
        const imgRes = await fetch(imgUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });

        if (imgRes.ok) {
          const imgData = await imgRes.json();
          const encoder = new TextEncoder();

          let parts: Array<Record<string, unknown>> = [];
          if (imgData.candidates) {
            parts = imgData.candidates[0]?.content?.parts || [];
          } else if (imgData.predictions) {
            parts = imgData.predictions.map((p: { bytesBase64Encoded: string; mimeType?: string }) => ({
              inlineData: { mimeType: p.mimeType || "image/png", data: p.bytesBase64Encoded },
            }));
          }

          const imgStream = new ReadableStream({
            start(controller) {
              for (const part of parts) {
                if (part.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
                }
                const inlineData = (part.inlineData || part.inline_data) as
                  | { mimeType?: string; mime_type?: string; data: string }
                  | undefined;
                if (inlineData) {
                  const dataUrl = `data:${inlineData.mimeType || inlineData.mime_type || "image/png"};base64,${inlineData.data}`;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ image: dataUrl })}\n\n`));
                }
              }
              if (!parts.some((p) => p.text)) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "สร้างรูปภาพเรียบร้อยแล้ว" })}\n\n`));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              kv.incr(usageKey).then(() => { kv.expire(usageKey, secondsUntilMidnight()); }).catch((err: unknown) => console.error("Quota error:", err));
              controller.close();
            },
          });

          return new Response(imgStream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
          });
        }

        const errText = await imgRes.text();
        lastImgError = `${imgModel}(${imgRes.status}): ${errText.slice(0, 150)}`;
        console.warn(`Image model ${imgModel} failed (${imgRes.status}): ${errText.slice(0, 200)}`);
      } catch (err) {
        lastImgError = `${imgModel}: ${err instanceof Error ? err.message : "unknown"}`;
        console.warn(`Image model ${imgModel} error:`, err);
      }
    }

    // All Gemini image models failed — try OpenRouter image generation as fallback
    console.warn(`All Gemini image models failed. Trying OpenRouter fallback...`);

    if (openRouterApiKey) {
      // Use an OpenRouter model that supports image generation
      const orImageModels = [
        "google/gemini-2.5-flash-preview:thinking", // Gemini via OpenRouter
        "google/gemini-2.5-flash-preview",
      ];

      for (const orModel of orImageModels) {
        try {
          console.log(`[OpenRouter Image Fallback] Trying ${orModel}`);
          const orImgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openRouterApiKey}`,
              "HTTP-Referer": "https://allquiz.app",
              "X-Title": "Allquiz AI",
            },
            body: JSON.stringify({
              model: orModel,
              messages: [
                { role: "system", content: "You are an image generation assistant. Create a detailed description of the requested image, then generate it. Respond with the image." },
                { role: "user", content: [
                  { type: "text", text: `Generate an image: ${lastUserMessage}` }
                ]},
              ],
              // Request image output if supported
              modalities: ["text", "image"],
              stream: true,
              max_tokens: 4096,
            }),
          });

          if (orImgRes.ok) {
            const orEncoder = new TextEncoder();
            const orImgStream = new ReadableStream({
              async start(controller) {
                const reader = orImgRes.body?.getReader();
                if (!reader) { controller.close(); return; }
                const decoder = new TextDecoder();
                let buf = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buf += decoder.decode(value, { stream: true });
                  const lines = buf.split("\n");
                  buf = lines.pop() || "";

                  for (const line of lines) {
                    if (line.startsWith("data: ")) {
                      const jsonStr = line.slice(6).trim();
                      if (jsonStr === "[DONE]") continue;
                      try {
                        const parsed = JSON.parse(jsonStr);
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) {
                          controller.enqueue(orEncoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                        }
                      } catch {}
                    }
                  }
                }

                controller.enqueue(orEncoder.encode("data: [DONE]\n\n"));
                try { await kv.incr(usageKey); await kv.expire(usageKey, secondsUntilMidnight()); } catch {}
                controller.close();
              },
            });

            return new Response(orImgStream, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
            });
          }
          console.warn(`[OpenRouter Image] ${orModel} failed: ${orImgRes.status}`);
        } catch (err) {
          console.warn(`[OpenRouter Image] ${orModel} error:`, err);
        }
      }
    }

    // Everything failed — return error
    console.error(`All image generation methods failed. Last: ${lastImgError}`);
    const discoveredInfo = discoveredImageModels.length > 0
      ? `พบโมเดลรูปภาพ: ${discoveredImageModels.join(", ")}`
      : `ไม่พบโมเดลรูปภาพใน API Key (มีทั้งหมด ${allModelNames.length} โมเดล)`;
    return new Response(
      JSON.stringify({
        error: `ไม่สามารถสร้างรูปภาพได้ — API ไม่รองรับการสร้างรูปภาพ`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // === CLAUDE API PATH ===
  // Skip Claude for image generation — always use Gemini's image API
  if (isClaudeModel && claudeApiKey && !generateImage) {
    // Filter out error messages and empty messages before processing
    const filteredMessages = truncatedMessages.filter((m: { role: string; content: string }) =>
      m.content && !m.content.startsWith("❌") && m.content.trim() !== ""
    );
    const rawClaudeMessages = filteredMessages.map((m: { role: string; content: string; files?: Array<{ data: string; type: string }> }) => {
      const contentParts: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];

      if (m.files && m.files.length > 0) {
        for (const file of m.files) {
          const match = file.data.match(/^data:(.+?);base64,(.+)$/);
          if (match && match[1].startsWith("image/")) {
            contentParts.push({
              type: "image",
              source: { type: "base64", media_type: match[1], data: match[2] }
            });
          }
        }
      }

      if (m.content) {
        contentParts.push({ type: "text", text: m.content });
      }

      if (contentParts.length === 0) {
        contentParts.push({ type: "text", text: "อธิบายข้อมูลนี้" });
      }

      return {
        role: m.role === "user" ? "user" : "assistant",
        content: contentParts,
      };
    });

    // Claude requires alternating user/assistant messages - merge consecutive same-role messages
    const claudeMessages: typeof rawClaudeMessages = [];
    for (const msg of rawClaudeMessages) {
      if (claudeMessages.length > 0 && claudeMessages[claudeMessages.length - 1].role === msg.role) {
        // Merge text content into previous message
        const prev = claudeMessages[claudeMessages.length - 1];
        prev.content = [...prev.content, ...msg.content];
      } else {
        claudeMessages.push({ ...msg, content: [...msg.content] });
      }
    }
    // Ensure first message is from user
    if (claudeMessages.length > 0 && claudeMessages[0].role !== "user") {
      claudeMessages.unshift({ role: "user", content: [{ type: "text", text: "สวัสดี" }] });
    }

    const isOpus = modelToUse.includes("opus");
    const claudeBody = {
      model: modelToUse,
      max_tokens: isOpus ? 16384 : 8192,
      system: systemInstruction,
      messages: claudeMessages,
      stream: true,
      ...(isOpus ? { temperature: 0.8 } : { temperature: 0.7 }),
    };

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(claudeBody),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error(`[Claude API Error] ${claudeRes.status}: ${errText}`);
      // User-friendly error messages
      let userError = "ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองเปลี่ยนโมเดลหรือลองใหม่อีกครั้ง";
      if (claudeRes.status === 401) userError = "API Key ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ";
      else if (claudeRes.status === 429) userError = "คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่";
      else if (claudeRes.status === 400 && errText.includes("credit")) userError = "โมเดลนี้ไม่พร้อมใช้งานชั่วคราว กรุณาเปลี่ยนเป็นโมเดลอื่น เช่น Pro 3.1 หรือ Flash";
      else if (claudeRes.status === 400) userError = "คำขอไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
      return new Response(
        JSON.stringify({ error: userError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send web search sources at stream start
        if (webSearchSources.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources: webSearchSources })}\n\n`));
        }
        const reader = claudeRes.body?.getReader();
        if (!reader) { controller.close(); return; }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
                  );
                }
              } catch {
                // skip
              }
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        try {
          await kv.incr(usageKey);
          await kv.expire(usageKey, secondsUntilMidnight());
        } catch (err) {
          console.error("Failed to increment quota:", err);
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // === NORMAL GEMINI CHAT (streaming) ===
  // Fallback chain: try primary model, then alternatives, then Claude as last resort
  const fallbackModels = [modelToUse, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];
  // Remove duplicates while preserving order
  const modelsToTry = [...new Set(fallbackModels)];

  const apiVersion = "v1beta";
  let geminiRes: Response | null = null;
  let lastError = "";

  for (const model of modelsToTry) {
    const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (res.ok) {
      geminiRes = res;
      console.log(`Using model: ${model}`);
      break;
    }

    const errText = await res.text();
    console.warn(`Model ${model} failed (${res.status}), trying next...`);
    console.error(`[Gemini API Error] ${res.status}: ${errText.slice(0, 300)}`);
    lastError = errText;

    // Try next model for 404 (not found), 429 (rate limited), or 403 (access denied)
    if (res.status === 404 || res.status === 429 || res.status === 403) {
      continue;
    }

    // Other errors — stop trying Gemini
    break;
  }

  // If all Gemini models failed, try OpenRouter then Claude
  if (!geminiRes && openRouterApiKey) {
    console.log("[Fallback] All Gemini models failed, trying OpenRouter...");
    const orFallbackModel = "google/gemini-2.5-flash";
    try {
      const orFallbackRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": "https://allquiz.app",
          "X-Title": "Allquiz AI",
        },
        body: JSON.stringify({
          model: orFallbackModel,
          messages: [
            { role: "system", content: systemInstruction },
            ...truncatedMessages.filter((m: { content: string }) => m.content && m.content.trim()).map((m: { role: string; content: string }) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 8192,
        }),
      });

      if (orFallbackRes.ok) {
        console.log(`[OpenRouter Fallback] Using ${orFallbackModel}`);
        const orFbEncoder = new TextEncoder();
        const orFbStream = new ReadableStream({
          async start(controller) {
            if (webSearchSources.length > 0) {
              controller.enqueue(orFbEncoder.encode(`data: ${JSON.stringify({ sources: webSearchSources })}\n\n`));
            }
            const reader = orFallbackRes.body?.getReader();
            if (!reader) { controller.close(); return; }
            const decoder = new TextDecoder();
            let buf = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() || "";
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const jsonStr = line.slice(6).trim();
                  if (jsonStr === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) {
                      controller.enqueue(orFbEncoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                    }
                  } catch {}
                }
              }
            }
            controller.enqueue(orFbEncoder.encode("data: [DONE]\n\n"));
            try { await kv.incr(usageKey); await kv.expire(usageKey, secondsUntilMidnight()); } catch {}
            controller.close();
          },
        });

        return new Response(orFbStream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
        });
      }
      console.warn(`[OpenRouter Fallback] ${orFallbackModel} failed: ${orFallbackRes.status}`);
    } catch (err) {
      console.warn("[OpenRouter Fallback] Error:", err);
    }
  }

  if (!geminiRes && claudeApiKey) {
    console.log("[Fallback] All Gemini+OpenRouter models failed, falling back to Claude...");

    const filteredMsgs = truncatedMessages.filter((m: { role: string; content: string }) =>
      m.content && !m.content.startsWith("❌") && m.content.trim() !== ""
    );
    const rawClaudeMsgs = filteredMsgs.map((m: { role: string; content: string; files?: Array<{ data: string; type: string }> }) => {
      const parts: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];
      if (m.files && m.files.length > 0) {
        for (const file of m.files) {
          const match = file.data.match(/^data:(.+?);base64,(.+)$/);
          if (match && match[1].startsWith("image/")) {
            parts.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
          }
        }
      }
      if (m.content) parts.push({ type: "text", text: m.content });
      if (parts.length === 0) parts.push({ type: "text", text: "อธิบายข้อมูลนี้" });
      return { role: m.role === "user" ? "user" : "assistant", content: parts };
    });

    const claudeFallbackMsgs: typeof rawClaudeMsgs = [];
    for (const msg of rawClaudeMsgs) {
      if (claudeFallbackMsgs.length > 0 && claudeFallbackMsgs[claudeFallbackMsgs.length - 1].role === msg.role) {
        claudeFallbackMsgs[claudeFallbackMsgs.length - 1].content.push(...msg.content);
      } else {
        claudeFallbackMsgs.push({ ...msg, content: [...msg.content] });
      }
    }
    if (claudeFallbackMsgs.length > 0 && claudeFallbackMsgs[0].role !== "user") {
      claudeFallbackMsgs.unshift({ role: "user", content: [{ type: "text", text: "สวัสดี" }] });
    }

    const claudeFallbackRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemInstruction,
        messages: claudeFallbackMsgs,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!claudeFallbackRes.ok) {
      const errText = await claudeFallbackRes.text();
      console.error(`[Claude Fallback Error] ${claudeFallbackRes.status}: ${errText}`);
      return new Response(
        JSON.stringify({ error: "AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const fallbackEncoder = new TextEncoder();
    const fallbackStream = new ReadableStream({
      async start(controller) {
        if (webSearchSources.length > 0) {
          controller.enqueue(fallbackEncoder.encode(`data: ${JSON.stringify({ sources: webSearchSources })}\n\n`));
        }
        const reader = claudeFallbackRes.body?.getReader();
        if (!reader) { controller.close(); return; }
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  controller.enqueue(fallbackEncoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                }
              } catch {}
            }
          }
        }
        controller.enqueue(fallbackEncoder.encode("data: [DONE]\n\n"));
        try { await kv.incr(usageKey); await kv.expire(usageKey, secondsUntilMidnight()); } catch {}
        controller.close();
      },
    });

    return new Response(fallbackStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  if (!geminiRes) {
    return new Response(
      JSON.stringify({ error: "AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream the SSE response back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send web search sources at stream start (supplement Gemini grounding)
      if (webSearchSources.length > 0) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources: webSearchSources })}\n\n`));
      }
      const reader = geminiRes.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const parts = parsed.candidates?.[0]?.content?.parts || [];

              for (const part of parts) {
                // Handle text parts
                if (part.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`)
                  );
                }
                // Handle inline image data (from image generation)
                if (part.inline_data) {
                  const imgData = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ image: imgData })}\n\n`)
                  );
                }
              }

              // Handle grounding metadata (search results)
              const grounding = parsed.candidates?.[0]?.groundingMetadata;
              // Send search queries so client can show what's being searched
              if (grounding?.webSearchQueries && grounding.webSearchQueries.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ searchQueries: grounding.webSearchQueries })}\n\n`)
                );
              }
              if (grounding?.searchEntryPoint?.renderedContent) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ searchWidget: grounding.searchEntryPoint.renderedContent })}\n\n`)
                );
              }
              if (grounding?.groundingChunks && grounding.groundingChunks.length > 0) {
                const sources = grounding.groundingChunks
                  .filter((c: { web?: { uri: string; title: string } }) => c.web)
                  .map((c: { web: { uri: string; title: string } }) => ({
                    title: c.web.title,
                    url: c.web.uri,
                  }));
                if (sources.length > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
                  );
                }
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      
      // Increment quota only after successful stream completion
      try {
        await kv.incr(usageKey);
        await kv.expire(usageKey, secondsUntilMidnight());
      } catch (err) {
        console.error("Failed to increment quota:", err);
      }
      
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
