import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { isValidSession } from "@/lib/admin-store";

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId } = await request.json();
  
  if (!shareId) {
    return NextResponse.json({ error: "Invalid shareId" }, { status: 400 });
  }

  // Verify format to prevent accidental deletions of other keys
  if (!shareId.startsWith("share_")) {
    return NextResponse.json({ error: "Invalid shareId format" }, { status: 400 });
  }

  await kv.del(`ai_shared_chat:${shareId}`);

  return NextResponse.json({ success: true });
}
