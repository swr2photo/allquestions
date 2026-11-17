import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { isValidSession, getSessionInfo } from "@/lib/admin-store";

const SHARE_ID_RE = /^share_[A-Za-z0-9_-]{1,128}$/;
const MAX_SHARE_BYTES = 1_000_000;
const MAX_TTL_DAYS = 365;

export async function POST(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getSessionInfo(token);
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const text = await request.text();
  if (text.length > MAX_SHARE_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: { session?: { id?: unknown; messages?: unknown }; expiresInDays?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { session, expiresInDays } = body;

  if (!session || typeof session.id !== "string" || !Array.isArray(session.messages)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Use the session ID so the link is stable and automatically updates the same URL
  const shareId = session.id.startsWith("share_") ? session.id : `share_${session.id}`;
  if (!SHARE_ID_RE.test(shareId)) {
    return NextResponse.json({ error: "Invalid shareId" }, { status: 400 });
  }
  const key = `ai_shared_chat:${shareId}`;

  // Only the original sharer may overwrite an existing link.
  const existing = await kv.get<{ sharedBy?: string }>(key);
  if (existing && existing.sharedBy?.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await kv.set(key, {
    ...session,
    sharedBy: user.email,
    sharedAt: Date.now()
  });

  // If expiresInDays is -1, it means no expiration (never expire)
  const days = typeof expiresInDays === "number" && Number.isFinite(expiresInDays) ? expiresInDays : 30;
  if (days === -1) {
    await kv.persist(key);
  } else {
    const ttlDays = Math.min(Math.max(Math.floor(days) || 30, 1), MAX_TTL_DAYS);
    await kv.expire(key, ttlDays * 60 * 60 * 24);
  }

  return NextResponse.json({ shareId, url: `/share/${shareId}` });
}
