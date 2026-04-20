import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { isValidSession, getSessionInfo } from "@/lib/admin-store";
import { ChatSession, Folder } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getSessionInfo(token);
  if (!user?.email) return NextResponse.json({ error: "User not found" }, { status: 400 });

  try {
    const data = await kv.get<{ sessions: ChatSession[], folders: Folder[] }>(`ai_user_sessions:${user.email}`);
    if (!data) return NextResponse.json({ sessions: [], folders: [] });
    
    // Compatibility check: if data is just an array, it's the old format
    if (Array.isArray(data)) {
      return NextResponse.json({ sessions: data as ChatSession[], folders: [] });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load sessions:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getSessionInfo(token);
  if (!user?.email) return NextResponse.json({ error: "User not found" }, { status: 400 });

  try {
    const { sessions, folders } = await request.json();
    if (!Array.isArray(sessions)) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    // Store in KV
    await kv.set(`ai_user_sessions:${user.email}`, { sessions, folders: folders || [] });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save sessions:", error);
    return NextResponse.json({ error: "Failed to save sessions" }, { status: 500 });
  }
}
