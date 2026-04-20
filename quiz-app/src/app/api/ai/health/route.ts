import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";
import { getProviderHealth } from "@/lib/ai-health";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ gemini: false, claude: false, openrouter: false, thaillm: false, groq: false, github: false });
  }

  const health = await getProviderHealth();

  return NextResponse.json({
    gemini: health.gemini,
    claude: health.claude,
    openrouter: health.openrouter,
    thaillm: health.thaillm,
    groq: health.groq,
    github: health.github,
  });
}
