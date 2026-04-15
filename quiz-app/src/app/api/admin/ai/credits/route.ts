import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { isValidSession } from "@/lib/admin-store";
import { creditsKey, addCreditLog } from "@/lib/credits";

function adminGuard(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!token || !isValidSession(token)) return false;
  return true;
}

// GET — list all user credit balances
export async function GET(request: NextRequest) {
  if (!adminGuard(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await kv.keys("ai_credits:*");
    if (!keys || keys.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Filter out log keys
    const balanceKeys = keys.filter(k => !k.includes("_log"));

    const users: { email: string; credits: number }[] = [];
    for (const key of balanceKeys) {
      const balance = await kv.get<number>(key) ?? 0;
      users.push({
        email: key.replace("ai_credits:", ""),
        credits: balance,
      });
    }

    users.sort((a, b) => b.credits - a.credits);
    return NextResponse.json({ users });
  } catch (err) {
    console.error("[Admin Credits Error]", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST — add/subtract credits for a user
export async function POST(request: NextRequest) {
  if (!adminGuard(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, amount } = body as { email?: string; amount?: number };

    if (!email || typeof amount !== "number" || amount === 0) {
      return NextResponse.json({ error: "ต้องระบุ email และจำนวนเครดิต" }, { status: 400 });
    }

    if (Math.abs(amount) > 100000) {
      return NextResponse.json({ error: "จำนวนเครดิตเกินขีดจำกัด" }, { status: 400 });
    }

    const currentBalance = await kv.get<number>(creditsKey(email)) ?? 0;
    const newBalance = Math.max(0, currentBalance + amount);
    await kv.set(creditsKey(email), newBalance);

    await addCreditLog(email, {
      amount,
      type: amount > 0 ? "bonus" : "usage",
      description: amount > 0 ? "เครดิตจากแอดมิน" : "หักเครดิตโดยแอดมิน",
      balanceAfter: newBalance,
    });

    return NextResponse.json({ email, credits: newBalance, added: amount });
  } catch (err) {
    console.error("[Admin Credits Error]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
