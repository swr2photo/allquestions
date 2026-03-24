import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userToken = request.cookies.get("user-session")?.value;
  const adminToken = request.cookies.get("admin-session")?.value;
  const token = userToken || adminToken;
  
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = getSessionInfo(token);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await kv.get<number>(`ai_usage:${user.email}`) || 0;
  
  return NextResponse.json({
    usage,
    limit: 20,
    remaining: Math.max(0, 20 - usage)
  });
}
