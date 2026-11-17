import { NextResponse, type NextRequest } from "next/server";
import { getSessionInfo, isValidAdminSession } from "@/lib/session-token";
import { bucketFor, rateLimit } from "@/lib/rate-limit";

// Admin-only API paths. The route handlers check this too; the proxy is a second lock.
const ADMIN_API_PREFIXES = ["/api/admin/", "/api/courses/", "/api/sheets", "/api/sentry-example-api", "/api/ai/notebooklm/auth"];
const PUBLIC_ADMIN_PATHS = new Set(["/api/admin/auth"]);
// Course/question APIs that require any signed-in user session (the route handlers check this too).
const SIGNED_IN_API_PREFIXES = ["/api/search/", "/api/faculties/", "/api/gened/offered/"];

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function json(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Block cross-site writes (CSRF): browsers always send Origin on cross-origin POST/PUT/PATCH/DELETE. */
function isCrossSite(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
      return new URL(origin).host !== host;
    } catch {
      return true;
    }
  }
  return req.headers.get("sec-fetch-site") === "cross-site";
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

function isAdminApi(pathname: string): boolean {
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return false;
  return matchesPrefix(pathname, ADMIN_API_PREFIXES);
}

function isSignedInApi(pathname: string): boolean {
  return matchesPrefix(pathname, SIGNED_IN_API_PREFIXES);
}

function hasSignedInSession(req: NextRequest): boolean {
  return Boolean(
    getSessionInfo(req.cookies.get("user-session")?.value) ||
    isValidAdminSession(req.cookies.get("admin-session")?.value)
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (UNSAFE_METHODS.has(method) && isCrossSite(req)) {
    return json(403, "Cross-site request blocked");
  }

  if (isAdminApi(pathname) && !isValidAdminSession(req.cookies.get("admin-session")?.value)) {
    return json(401, "Unauthorized");
  }

  if (isSignedInApi(pathname) && !hasSignedInSession(req)) {
    return json(401, "Unauthorized");
  }

  // Signed-in users are limited per account (students on campus share one NAT IP); others per IP.
  const bucket = bucketFor(pathname, method);
  const user =
    bucket === "auth"
      ? null
      : getSessionInfo(req.cookies.get("user-session")?.value) || getSessionInfo(req.cookies.get("admin-session")?.value);
  const id = user?.email ? `u:${user.email.toLowerCase()}` : `ip:${clientIp(req)}`;
  const rl = await rateLimit(bucket, id);
  if (!rl.success) {
    const retryAfter = Math.max(Math.ceil((rl.reset - Date.now()) / 1000), 1);
    return json(429, "Too many requests", {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": "0",
    });
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(rl.limit));
  res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
