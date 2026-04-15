import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@vercel/kv";

function settingsKey(email: string) {
  return `ai_settings:${email}`;
}

// GET — load settings for current user
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ settings: null });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ settings: null });

  try {
    const raw = await kv.get(settingsKey(user.email));
    if (!raw) return NextResponse.json({ settings: null });
    // kv.get may return already-parsed object or a JSON string
    const settings = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: null });
  }
}

// POST — save settings for current user
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const settings = body.settings;

    // Validate settings payload size and structure
    const settingsJson = JSON.stringify(settings);
    if (settingsJson.length > 5000) {
      return NextResponse.json({ error: "Settings too large" }, { status: 400 });
    }
    if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    }

    // Store as JSON string, no expiry (permanent per-user settings)
    await kv.set(settingsKey(user.email), settingsJson);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Settings Save Error]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
