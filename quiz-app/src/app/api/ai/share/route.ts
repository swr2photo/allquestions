import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { isValidSession, getSessionInfo } from "@/lib/admin-store";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getSessionInfo(token);
  const { session, expiresInDays } = await request.json();
  
  if (!session || !session.id || !session.messages) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Use the session ID so the link is stable and automatically updates the same URL
  const shareId = session.id.startsWith("share_") ? session.id : `share_${session.id}`;
  
  await kv.set(`ai_shared_chat:${shareId}`, {
    ...session,
    sharedBy: user?.email || "Anonymous",
    sharedAt: Date.now()
  });
  
  // Set TTL for shared link (e.g. 30 days)
  // If expiresInDays is -1, it means no expiration (never expire)
  const ttl = expiresInDays === -1 ? null : (expiresInDays || 30) * 60 * 60 * 24;
  if (ttl) {
    await kv.expire(`ai_shared_chat:${shareId}`, ttl);
  } else {
    // Persistent (no expire)
    await kv.persist(`ai_shared_chat:${shareId}`);
  }

  return NextResponse.json({ shareId, url: `/share/${shareId}` });
}
