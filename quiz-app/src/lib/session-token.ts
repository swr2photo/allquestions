import crypto from "crypto";

// Get allowed admin emails from environment variable
export function getAdminEmailsFromEnv(): string[] {
  const envEmails = process.env.ADMIN_EMAILS || "doralaikon.th@gmail.com";
  return envEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Check if an email is allowed as admin
export function isAllowedAdminEmail(email: string): boolean {
  const allowed = getAdminEmailsFromEnv();
  return allowed.includes(email.toLowerCase().trim());
}

// Stateless JWT-like Session Store
//
// Session lifetime policy:
// - Admin: 7 days (slightly shorter because of higher privilege)
// - User:  30 days
// Both sessions support sliding refresh — every time the auth endpoint is
// hit with a valid token we re-issue a fresh cookie, so actively-using
// users never get kicked out mid-session.
export const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
export const USER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days
export const ADMIN_SESSION_MAX_AGE_SEC = Math.floor(ADMIN_SESSION_MAX_AGE_MS / 1000);
export const USER_SESSION_MAX_AGE_SEC = Math.floor(USER_SESSION_MAX_AGE_MS / 1000);

// Legacy alias kept for back-compat with any external callers.
// Defaults to the admin TTL — callers that care should pass maxAgeMs explicitly.
const DEFAULT_SESSION_MAX_AGE_MS = ADMIN_SESSION_MAX_AGE_MS;

// The signing key must never be guessable: anyone who knows it can mint an
// admin session. Prefer SESSION_SECRET; otherwise derive a key from another
// server-only secret so deployments without SESSION_SECRET stay safe.
function resolveSecretKey(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.length >= 32) return explicit;

  const serverSecret =
    process.env.allquiz_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY;
  if (serverSecret) {
    return crypto.createHmac("sha256", serverSecret).update("quiz-app-session-v2").digest("base64url");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (at least 32 characters) must be set in production");
  }
  return "dev-only-session-secret-not-for-production";
}

let cachedSecret: string | null = null;
function secretKey(): string {
  if (!cachedSecret) cachedSecret = resolveSecretKey();
  return cachedSecret;
}

export type SessionKind = "user" | "admin";

interface SessionInfo {
  email: string;
  name: string;
  picture: string;
}

interface StoredSession extends SessionInfo {
  expiresAt: number;
  issuedAt?: number;
  kind?: SessionKind;
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", secretKey()).update(payload).digest("base64url");
}

function signSession(data: StoredSession): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function readSession(token: string | null | undefined): StoredSession | null {
  if (!token || token.length > 4096) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  if (!safeEqual(signature, hmac(payload))) return null;

  try {
    const data: StoredSession = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.email !== "string" || !data.email) return null;
    if (typeof data.expiresAt !== "number" || Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

// Generate a signed session token. Pass `maxAgeMs` to override the default TTL.
// `kind` binds the token to one cookie, so a user token can't be replayed as an admin one.
export function createSessionToken(
  info: SessionInfo,
  maxAgeMs: number = DEFAULT_SESSION_MAX_AGE_MS,
  kind: SessionKind = "user"
): string {
  const now = Date.now();
  const sessionData: StoredSession = {
    email: info.email,
    name: info.name,
    picture: info.picture,
    issuedAt: now,
    expiresAt: now + maxAgeMs,
    kind,
  };
  return signSession(sessionData);
}

/** Any signed-in session (user or admin). Use for user-facing endpoints. */
export function isValidSession(token: string | null | undefined): boolean {
  return readSession(token) !== null;
}

export function getSessionInfo(token: string | null | undefined): SessionInfo | null {
  const data = readSession(token);
  if (!data) return null;
  return { email: data.email, name: data.name, picture: data.picture };
}

/**
 * Admin-only check: the token must have been issued by the admin login AND the
 * email must still be on the ADMIN_EMAILS allowlist (removing an email revokes access).
 */
export function isValidAdminSession(token: string | null | undefined): boolean {
  const data = readSession(token);
  return !!data && data.kind === "admin" && isAllowedAdminEmail(data.email);
}

export function getAdminSessionInfo(token: string | null | undefined): SessionInfo | null {
  return isValidAdminSession(token) ? getSessionInfo(token) : null;
}

/**
 * Sliding refresh — if the token is still valid, return a fresh token
 * with a full new TTL (same kind). Returns null if the existing token is invalid/expired.
 *
 * The caller is expected to re-set the cookie with the returned token.
 */
export function refreshSessionToken(
  token: string | null | undefined,
  maxAgeMs: number
): string | null {
  const data = readSession(token);
  if (!data) return null;
  return createSessionToken(data, maxAgeMs, data.kind === "admin" ? "admin" : "user");
}

