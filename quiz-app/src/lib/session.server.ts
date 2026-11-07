import type { NextRequest } from "next/server";
import { getSessionInfo } from "@/lib/admin-store";

/** The signed-in user (Google session or admin session), or null. */
export function sessionUser(req: NextRequest): { email: string; name: string } | null {
  for (const cookie of ["user-session", "admin-session"]) {
    const info = getSessionInfo(req.cookies.get(cookie)?.value);
    if (info?.email) return { email: info.email.toLowerCase(), name: info.name || "" };
  }
  return null;
}
