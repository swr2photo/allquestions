import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";

const HISTORY_PREFIX = "ai_history:";
const FOLDERS_PREFIX = "ai_folders:";

async function getAuthSession(req: NextRequest) {
  const userToken = req.cookies.get("user-session")?.value;
  const adminToken = req.cookies.get("admin-session")?.value;

  if (userToken && isValidSession(userToken)) {
    return { authenticated: true, user: getSessionInfo(userToken) };
  }
  if (adminToken && isValidSession(adminToken)) {
    return { authenticated: true, user: getSessionInfo(adminToken) };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.authenticated || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  try {
    const [sessions, folders] = await Promise.all([
      kv.get(`${HISTORY_PREFIX}${email}`),
      kv.get(`${FOLDERS_PREFIX}${email}`)
    ]);

    return NextResponse.json({
      sessions: sessions || [],
      folders: folders || []
    });
  } catch (error) {
    console.error("[History GET Error]:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.authenticated || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  try {
    const { sessions, folders } = await req.json();

    // บันทึกข้อมูลลง KV
    // Note: use try/catch around pipeline in case memory fallback doesn't support it yet
    try {
      const pipeline = kv.pipeline();
      if (sessions) pipeline.set(`${HISTORY_PREFIX}${email}`, sessions);
      if (folders) pipeline.set(`${FOLDERS_PREFIX}${email}`, folders);
      await pipeline.exec();
    } catch {
      // Fallback for memoryKv or if pipeline fails
      if (sessions) await kv.set(`${HISTORY_PREFIX}${email}`, sessions);
      if (folders) await kv.set(`${FOLDERS_PREFIX}${email}`, folders);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[History POST Error]:", error);
    return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.authenticated || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  try {
    await Promise.all([
      kv.del(`${HISTORY_PREFIX}${email}`),
      kv.del(`${FOLDERS_PREFIX}${email}`)
    ]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete history" }, { status: 500 });
  }
}
