import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { isValidSession } from "@/lib/admin-store";

interface PromoCode {
  code: string;
  credits: number;
  maxUses: number;
  usedBy: string[];
  createdAt: number;
}

function adminGuard(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!token || !isValidSession(token)) return false;
  return true;
}

// GET — list all promo codes
export async function GET(request: NextRequest) {
  if (!adminGuard(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await kv.keys("promo:*");
    if (!keys || keys.length === 0) {
      return NextResponse.json({ promos: [] });
    }

    const promos: PromoCode[] = [];
    for (const key of keys) {
      const raw = await kv.get(key);
      if (!raw) continue;
      const data = typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>;
      promos.push({
        code: key.replace("promo:", ""),
        credits: (data.credits as number) || 0,
        maxUses: (data.maxUses as number) || 0,
        usedBy: (data.usedBy as string[]) || [],
        createdAt: (data.createdAt as number) || 0,
      });
    }

    promos.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ promos });
  } catch (err) {
    console.error("[Admin Promos Error]", err);
    return NextResponse.json({ error: "Failed to fetch promos" }, { status: 500 });
  }
}

// POST — create a new promo code
export async function POST(request: NextRequest) {
  if (!adminGuard(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code, credits, maxUses } = body as {
      code?: string;
      credits?: number;
      maxUses?: number;
    };

    if (!credits || credits <= 0 || credits > 10000) {
      return NextResponse.json({ error: "จำนวนเครดิตไม่ถูกต้อง (1-10000)" }, { status: 400 });
    }

    // Auto-generate code if not provided
    const promoCode = (code || generateCode()).toUpperCase().trim();
    if (promoCode.length < 3 || promoCode.length > 30) {
      return NextResponse.json({ error: "รหัสต้องมี 3-30 ตัวอักษร" }, { status: 400 });
    }

    const key = `promo:${promoCode}`;
    const existing = await kv.get(key);
    if (existing) {
      return NextResponse.json({ error: "รหัสนี้มีอยู่แล้ว" }, { status: 409 });
    }

    const promoData = {
      credits,
      maxUses: maxUses ?? 1,
      usedBy: [],
      createdAt: Date.now(),
    };

    await kv.set(key, promoData);

    return NextResponse.json({ code: promoCode, ...promoData });
  } catch (err) {
    console.error("[Admin Promos Error]", err);
    return NextResponse.json({ error: "Failed to create promo" }, { status: 500 });
  }
}

// DELETE — delete a promo code
export async function DELETE(request: NextRequest) {
  if (!adminGuard(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    await kv.del(`promo:${code.toUpperCase().trim()}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AQ-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
