import { NextRequest, NextResponse } from "next/server";
import { getAllCoursesWithCustom } from "@/lib/merged-courses";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  // 2. Check Quota (Limit to 20 uses per day)
  const usageKey = `ai_usage:${user.email}`;
  const currentUsage = await kv.get<number>(usageKey) || 0;
  const LIMIT = 20;

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { messages, model: requestedModel, responseStyle, customInstructions, language, webSearch, generateImage } = await request.json();

  // 3. Determine Model
  let modelToUse = requestedModel || "auto";
  const hasFile = messages.some((m: any) => m.files && m.files.length > 0);

  if (modelToUse === "auto") {
    if (hasFile || messages.length > 10) {
      modelToUse = "gemini-3.1-pro";
    } else {
      modelToUse = "gemini-2.5-flash";
    }
  }

  // Map any legacy model names
  const modelMap: Record<string, string> = {
    "gemini-1.5-pro": "gemini-3.1-pro",
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-3.1-pro": "gemini-3.1-pro",
  };

  modelToUse = modelMap[modelToUse] || "gemini-2.5-flash";

  // Build quiz context for AI
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
  let quizContext = contextParts.join("\n\n---\n\n");
  if (quizContext.length > 60000) {
    quizContext = quizContext.slice(0, 60000) + "\n\n[...ข้อมูลถูกตัดบางส่วนเนื่องจากข้อจำกัดขนาด]";
  }

  // Build response style instruction
  const styleInstruction = responseStyle === "detailed"
    ? "\n- ตอบอย่างละเอียด มีตัวอย่างประกอบ อธิบายเพิ่มเติมให้เข้าใจ"
    : "\n- ตอบกระชับ ตรงประเด็น ไม่ยืดยาว";

  // Build custom instructions
  const customInstructionBlock = customInstructions
    ? `\n\nข้อมูลเพิ่มเติมจากผู้ใช้:\n${customInstructions}`
    : "";

  const systemInstruction = `คุณคือ Allquiz AI ผู้ช่วยตรวจสอบคำตอบข้อสอบอัจฉริยะ

หน้าที่ของคุณ:
1. ตอบคำถามเกี่ยวกับข้อสอบที่มีในระบบ Allquiz
2. ช่วยตรวจสอบว่าคำตอบใดถูกต้อง และอธิบายเหตุผล
3. สรุปเนื้อหาจากข้อสอบ
4. ช่วยอธิบายเนื้อหาวิชาที่เกี่ยวข้องกับข้อสอบ
5. วิเคราะห์ไฟล์และรูปภาพที่ผู้ใช้อัปโหลด${customInstructionBlock}

การจัดการไฟล์ที่อัปโหลด:
- เมื่อผู้ใช้อัปโหลดไฟล์ (รูปภาพ, PDF, เอกสาร) ให้จดจำเนื้อหาทั้งหมดอย่างละเอียด
- เมื่อตอบคำถามเกี่ยวกับไฟล์ที่อัปโหลด ให้อ้างอิงจากเนื้อหาในไฟล์โดยตรง 100% ห้ามเดาหรือสร้างข้อมูลเอง
- หากมีข้อสอบในไฟล์ ให้อ่านทุกข้อและเก็บไว้ในความจำตลอดการสนทนา
- เมื่อผู้ใช้ถามเกี่ยวกับเนื้อหาที่เคยอัปโหลด ให้ย้อนอ้างอิงจากไฟล์เดิมเสมอ
- หากเป็นรูปข้อสอบ ให้อ่านข้อความในรูปอย่างละเอียดทุกตัวอักษรก่อนตอบ

รูปแบบการตอบ:
- ทุกครั้งที่ตอบ ให้เริ่มด้วยกระบวนการคิดวิเคราะห์ภายใน <think> ... </think> tags
- ใน <think> ให้เขียนขั้นตอนการวิเคราะห์อย่างละเอียด เช่น:
  - ตีความคำถาม
  - ค้นหาข้อมูลที่เกี่ยวข้องในระบบ
  - เปรียบเทียบตัวเลือก
  - สรุปเหตุผล
- หลังจาก </think> ให้เขียนคำตอบสุดท้ายสำหรับผู้ใช้

กฎ:
- ตอบเป็นภาษา${language === "en" ? "อังกฤษ" : language === "zh" ? "จีน" : language === "ja" ? "ญี่ปุ่น" : language === "ko" ? "เกาหลี" : "ไทย"}
- หากมีคำถามที่ตรงกับข้อสอบในระบบ ให้อ้างอิงจากข้อมูลด้านล่าง
- หากไม่เกี่ยวกับข้อสอบ สามารถตอบคำถามทั่วไปได้
- ใช้ Markdown ในการจัดรูปแบบคำตอบ (bold, list, etc.)${styleInstruction}

ข้อมูลข้อสอบในระบบ:

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
    ...messages.map((m: { role: string; content: string; files?: Array<{ data: string; type: string }>; generatedImages?: string[] }) => {
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

  // Build request body with optional tools
  const body: Record<string, unknown> = {
    contents: geminiMessages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  // Enable Google Search grounding when webSearch is requested
  if (webSearch) {
    body.tools = [{ google_search: {} }];
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
    const imageModels = [
      ...discoveredImageModels,
      "gemini-2.0-flash-preview-image-generation",
      "gemini-2.0-flash-exp-image-generation",
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash",
      "imagen-3.0-generate-002",
      "imagen-3.0-fast-generate-001",
    ];
    // Dedupe
    const uniqueImageModels = [...new Set(imageModels)];

    let lastImgError = "";

    for (const imgModel of uniqueImageModels) {
      const isImagen = imgModel.startsWith("imagen");
      const endpoint = isImagen ? "predict" : "generateContent";
      const imgUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imgModel}:${endpoint}?key=${apiKey}`;

      const reqBody = isImagen
        ? {
            instances: [{ prompt: messages[messages.length - 1]?.content || "generate an image" }],
            parameters: { sampleCount: 1, aspectRatio: "1:1" },
          }
        : {
            contents: geminiMessages,
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              response_modalities: ["TEXT", "IMAGE"],
            },
          };

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

    // All failed - return detailed error with discovered models
    console.error(`All image models failed. Last: ${lastImgError}`);
    const discoveredInfo = discoveredImageModels.length > 0
      ? `พบโมเดลรูปภาพ: ${discoveredImageModels.join(", ")}`
      : `ไม่พบโมเดลรูปภาพใน API Key (มีทั้งหมด ${allModelNames.length} โมเดล)`;
    return new Response(
      JSON.stringify({
        error: `ไม่สามารถสร้างรูปภาพได้ | ${discoveredInfo} | ${lastImgError}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // === NORMAL CHAT (streaming) ===
  // Fallback chain: if primary model fails (404), try next model
  const fallbackModels = [modelToUse, "gemini-2.5-flash", "gemini-2.5-pro-preview-05-06"];
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
      body: JSON.stringify(body),
    });

    if (res.ok) {
      geminiRes = res;
      console.log(`Using model: ${model}`);
      break;
    }

    // If 404 (model not found), try next model
    const errText = await res.text();
    console.warn(`Model ${model} failed (${res.status}), trying next...`);
    lastError = errText;

    if (res.status !== 404) {
      return new Response(
        JSON.stringify({ error: `AI error (${res.status}): ${errText.slice(0, 200)}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (!geminiRes) {
    return new Response(
      JSON.stringify({ error: `ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่อีกครั้ง` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream the SSE response back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
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
