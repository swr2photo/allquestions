import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/admin-store";
import { getGlobalChatHistory } from "@/lib/ai-stats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (!isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await getGlobalChatHistory();
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
