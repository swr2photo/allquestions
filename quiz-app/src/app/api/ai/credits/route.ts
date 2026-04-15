import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";
import { MODEL_CREDITS, creditsKey, addCreditLog, type CreditLog } from "@/lib/credits";

export const dynamic = "force-dynamic";

// GET — get credit balance and recent history
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ credits: 0, logs: [] });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ credits: 0, logs: [] });

  try {
    const balance = await kv.get<number>(creditsKey(user.email)) ?? 0;
    const rawLogs = await kv.get(`ai_credits_log:${user.email}`);
    let logs: CreditLog[] = [];
    if (rawLogs) {
      logs = typeof rawLogs === "string" ? JSON.parse(rawLogs) : (rawLogs as CreditLog[]);
      if (!Array.isArray(logs)) logs = [];
    }

    return NextResponse.json({
      credits: balance,
      logs: logs.slice(0, 20), // Last 20 entries
      pricing: MODEL_CREDITS,
    });
  } catch {
    return NextResponse.json({ credits: 0, logs: [] });
  }
}

// POST — add credits (admin or promo code)
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { action, amount, promoCode, targetEmail } = body as {
      action: "topup" | "redeem" | "admin_add";
      amount?: number;
      promoCode?: string;
      targetEmail?: string;
    };

    // Promo code redemption
    if (action === "redeem" && promoCode) {
      const codeKey = `promo:${promoCode.toUpperCase().trim()}`;
      const codeData = await kv.get(codeKey);
      if (!codeData) {
        return NextResponse.json({ error: "รหัสโปรโมชั่นไม่ถูกต้อง" }, { status: 400 });
      }

      const code = typeof codeData === "string" ? JSON.parse(codeData) : codeData as {
        credits: number;
        maxUses: number;
        usedBy: string[];
      };

      if (code.usedBy?.includes(user.email)) {
        return NextResponse.json({ error: "คุณใช้รหัสนี้แล้ว" }, { status: 400 });
      }
      if (code.maxUses > 0 && (code.usedBy?.length || 0) >= code.maxUses) {
        return NextResponse.json({ error: "รหัสนี้ถูกใช้ครบจำนวนแล้ว" }, { status: 400 });
      }

      // Add credits
      const currentBalance = await kv.get<number>(creditsKey(user.email)) ?? 0;
      const newBalance = currentBalance + code.credits;
      await kv.set(creditsKey(user.email), newBalance);

      // Mark code as used
      code.usedBy = [...(code.usedBy || []), user.email];
      await kv.set(codeKey, typeof codeData === "string" ? JSON.stringify(code) : code);

      // Log
      await addCreditLog(user.email, {
        amount: code.credits,
        type: "topup",
        description: `โปรโมชั่น: ${promoCode.toUpperCase()}`,
        balanceAfter: newBalance,
      });

      return NextResponse.json({ credits: newBalance, added: code.credits });
    }

    // Admin add credits to a user
    if (action === "admin_add" && targetEmail && amount) {
      // Check if current user is admin
      const adminToken = cookieStore.get("admin-session")?.value;
      if (!adminToken || !isValidSession(adminToken)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }

      const currentBalance = await kv.get<number>(creditsKey(targetEmail)) ?? 0;
      const newBalance = currentBalance + amount;
      await kv.set(creditsKey(targetEmail), newBalance);

      await addCreditLog(targetEmail, {
        amount,
        type: amount > 0 ? "bonus" : "usage",
        description: amount > 0 ? `เครดิตจากแอดมิน` : `หักเครดิตโดยแอดมิน`,
        balanceAfter: newBalance,
      });

      return NextResponse.json({ credits: newBalance, targetEmail });
    }

    // Self top-up (for future payment integration)
    if (action === "topup" && amount && amount > 0) {
      return NextResponse.json({
        error: "กรุณาใช้รหัสโปรโมชั่นหรือติดต่อแอดมินเพื่อเติมเครดิต",
        methods: [
          { type: "promo", label: "ใช้รหัสโปรโมชั่น" },
          { type: "admin", label: "ติดต่อแอดมิน" },
        ],
      }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[Credits Error]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
