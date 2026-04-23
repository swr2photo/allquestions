import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo, isValidSession, isAllowedAdminEmail } from "@/lib/admin-store";
import { kv } from "@/lib/kv";

const SCHEDULE_KEY_PREFIX = "schedule:";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getSessionInfo(token!);
  if (!session?.email) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Restrict to admins only
  if (!isAllowedAdminEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const schedule = await kv.get(`${SCHEDULE_KEY_PREFIX}${session.email}`);
  return NextResponse.json({ schedule: schedule || [] });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("user-session")?.value || request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getSessionInfo(token!);
  if (!session?.email) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Restrict to admins only
  if (!isAllowedAdminEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { schedule } = await request.json();
    await kv.set(`${SCHEDULE_KEY_PREFIX}${session.email}`, schedule);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 });
  }
}
