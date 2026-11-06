import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

const TERM_ID = /^\d{4}-\d$/;

function isSignedIn(req: NextRequest): boolean {
  for (const name of ["user-session", "admin-session"]) {
    const token = req.cookies.get(name)?.value;
    if (token && isValidSession(token) && getSessionInfo(token)?.email) return true;
  }
  return false;
}

// GET /api/timetable/terms/<year>-<term> — term course data, signed-in users only
export async function GET(req: NextRequest, { params }: { params: Promise<{ termId: string }> }) {
  const noStore = { "Cache-Control": "no-store" };
  if (!isSignedIn(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }
  const { termId } = await params;
  if (!TERM_ID.test(termId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  }
  try {
    const file = path.join(process.cwd(), "data", "timetable", "terms", `${termId}.json`);
    const body = await fs.readFile(file, "utf8");
    return new NextResponse(body, {
      headers: { "Content-Type": "application/json", ...noStore },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  }
}