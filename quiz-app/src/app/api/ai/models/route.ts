import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ models: [] });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  const results: any = { gemini: [], openrouter: [], groq: [], github: [] };

  // 1. Fetch Gemini Models
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, { next: { revalidate: 3600 } });
      const data = await res.json();
      results.gemini = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => ({
          id: m.name?.replace("models/", ""),
          name: m.displayName,
          provider: "gemini"
        }));
    } catch (e) { console.error("Gemini models fetch failed", e); }
  }

  // 2. Fetch OpenRouter Models (Includes Claude, GPT-4, Llama, etc.)
  if (openRouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${openRouterKey}` },
        next: { revalidate: 3600 }
      });
      const data = await res.json();
      results.openrouter = (data.data || []).map((m: any) => ({
        id: `openrouter/${m.id}`,
        name: m.name,
        provider: "openrouter",
        pricing: m.pricing,
        context_length: m.context_length
      }));
    } catch (e) { console.error("OpenRouter models fetch failed", e); }
  }

  // 3. Fetch Groq Models
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${groqKey}` },
        next: { revalidate: 3600 }
      });
      const data = await res.json();
      results.groq = (data.data || []).map((m: any) => ({
        id: `groq/${m.id}`,
        name: m.id,
        provider: "groq"
      }));
    } catch (e) { console.error("Groq models fetch failed", e); }
  }

  // 4. Fetch GitHub Models
  if (githubToken) {
    try {
      const res = await fetch("https://models.inference.ai.azure.com/models", {
        headers: { "Authorization": `Bearer ${githubToken}` },
        next: { revalidate: 3600 }
      });
      if (res.ok) {
        const data = await res.json();
        results.github = (data || []).map((m: any) => ({
          id: `github/${m.name}`,
          name: m.friendlyName || m.name,
          provider: "github"
        }));
      } else {
        // Fallback for GitHub models if listing is not supported/accessible
        results.github = [
          { id: "github/gpt-4o", name: "GPT-4o", provider: "github" },
          { id: "github/gpt-4o-mini", name: "GPT-4o mini", provider: "github" },
          { id: "github/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "github" },
          { id: "github/phi-4", name: "Phi-4", provider: "github" },
        ];
      }
    } catch (e) { console.error("GitHub models fetch failed", e); }
  }

  return NextResponse.json(results);
}
