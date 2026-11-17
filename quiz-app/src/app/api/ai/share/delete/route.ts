import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { getSessionInfo, isAllowedAdminEmail, isValidSession } from "@/lib/admin-store";

const SHARE_ID_RE = /^share_[A-Za-z0-9_-]{1,128}$/;

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = getSessionInfo(token);
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId } = await request.json().catch(() => ({}));

  // Verify format to prevent deletions of other keys
  if (typeof shareId !== "string" || !SHARE_ID_RE.test(shareId)) {
    return NextResponse.json({ error: "Invalid shareId format" }, { status: 400 });
  }

  const key = `ai_shared_chat:${shareId}`;
  const existing = await kv.get<{ sharedBy?: string }>(key);
  if (!existing) return NextResponse.json({ success: true });

  // Only the person who shared it (or an admin) may remove the link.
  const isOwner = existing.sharedBy?.toLowerCase() === user.email.toLowerCase();
  if (!isOwner && !isAllowedAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await kv.del(key);

  return NextResponse.json({ success: true });
}
