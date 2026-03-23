import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { isValidSession } from "@/lib/admin-store";

// GET /api/admin/ai/quotas - List all user quotas
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get all keys starting with ai_usage:
    const keys = await kv.keys("ai_usage:*");
    if (!keys || keys.length === 0) {
      return NextResponse.json({ success: true, quotas: [] });
    }

    // 2. Multi-get values
    const values = await kv.mget<number[]>(...keys);
    
    // 3. Map to objects
    const quotas = keys.map((key, index) => ({
      email: key.replace("ai_usage:", ""),
      usage: values[index] || 0,
      limit: 20, // Updated per requirements
    }));

    // Sort by usage descending
    quotas.sort((a, b) => b.usage - a.usage);

    return NextResponse.json({ success: true, quotas });
  } catch (error) {
    console.error("Admin Quota API Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch quotas" }, { status: 500 });
  }
}

// DELETE /api/admin/ai/quotas?email=xxx - Reset a user's quota
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ success: false, error: "Missing email" }, { status: 400 });
  }

  try {
    await kv.del(`ai_usage:${email}`);
    return NextResponse.json({ success: true, message: `Reset quota for ${email}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to reset quota" }, { status: 500 });
  }
}
