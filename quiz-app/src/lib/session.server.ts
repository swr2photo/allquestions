import type { NextRequest } from "next/server";
import { getAdminSessionInfo, getSessionInfo } from "@/lib/admin-store";

/** The signed-in user (Google session or admin session), or null. */
export function sessionUser(req: NextRequest): { email: string; name: string } | null {
  const userInfo = getSessionInfo(req.cookies.get("user-session")?.value);
  if (userInfo?.email) return { email: userInfo.email.toLowerCase(), name: userInfo.name || "" };

  const adminInfo = getAdminSessionInfo(req.cookies.get("admin-session")?.value);
  if (adminInfo?.email) return { email: adminInfo.email.toLowerCase(), name: adminInfo.name || "" };

  return null;
}
