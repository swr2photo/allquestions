import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";

async function requireAdmin() {
  const token = (await cookies()).get("admin-session")?.value;
  return isValidSession(token);
}

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  throw new Error("Sentry Example API Route Error");
}
