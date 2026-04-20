import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";

export const dynamic = "force-dynamic";

export interface UserQuotaInfo {
  email: string;
  dailyUsage: number;
  credits: number;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const usageKeys = await kv.keys("ai_usage:*");
    const creditKeys = await kv.keys("ai_credits:*");

    const emails = new Set<string>();
    usageKeys.forEach(k => emails.add(k.replace("ai_usage:", "")));
    creditKeys.forEach(k => emails.add(k.replace("ai_credits:", "")));

    const users: UserQuotaInfo[] = [];

    for (const email of emails) {
      const dailyUsage = await kv.get<number>(`ai_usage:${email}`) || 0;
      const credits = await kv.get<number>(`ai_credits:${email}`) || 0;
      users.push({ email, dailyUsage, credits });
    }

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email, credits, action } = await request.json();
    if (!email || typeof credits !== "number") {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    let newBalance = credits;
    if (action === "add") {
      const current = await kv.get<number>(`ai_credits:${email}`) || 0;
      newBalance = current + credits;
    }

    await kv.set(`ai_credits:${email}`, newBalance);
    return NextResponse.json({ success: true, newBalance });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update credits" }, { status: 500 });
  }
}
