import { NextRequest, NextResponse } from "next/server";
import {
  verifyGoogleToken,
  isAllowedAdminEmail,
  createSessionToken,
  isValidSession,
  getSessionInfo,
  refreshSessionToken,
  ADMIN_SESSION_MAX_AGE_MS,
  ADMIN_SESSION_MAX_AGE_SEC,
  USER_SESSION_MAX_AGE_MS,
  USER_SESSION_MAX_AGE_SEC,
} from "@/lib/admin-store";

const isProd = process.env.NODE_ENV === "production";

// POST /api/admin/auth - Google Sign-In
export async function POST(request: NextRequest) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json(
        { success: false, error: "ไม่พบข้อมูลการเข้าสู่ระบบ" },
        { status: 400 }
      );
    }

    // Verify the Google ID token
    const userInfo = await verifyGoogleToken(credential);
    if (!userInfo) {
      return NextResponse.json(
        { success: false, error: "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่" },
        { status: 401 }
      );
    }

    // Check if the email is allowed
    if (!isAllowedAdminEmail(userInfo.email)) {
      return NextResponse.json(
        {
          success: false,
          error: `อีเมล ${userInfo.email} ไม่ได้รับอนุญาตให้เข้าสู่ระบบ`,
        },
        { status: 403 }
      );
    }

    const adminToken = createSessionToken(
      {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
      ADMIN_SESSION_MAX_AGE_MS
    );

    // Issue a user-session too, so admins don't need to log in a second time
    // when visiting user-facing pages like /ai.
    const userToken = createSessionToken(
      {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
      USER_SESSION_MAX_AGE_MS
    );

    const response = NextResponse.json({
      success: true,
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
    });

    response.cookies.set("admin-session", adminToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: ADMIN_SESSION_MAX_AGE_SEC,
      path: "/",
    });

    response.cookies.set("user-session", userToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: USER_SESSION_MAX_AGE_SEC,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/auth - Logout
// Admin login sets both admin-session and user-session, so logout clears both.
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("admin-session");
  response.cookies.delete("user-session");
  return response;
}

// GET /api/admin/auth - Check session + sliding refresh
//
// If the token is still valid, we re-issue the cookie with a fresh TTL on
// every call. That means actively-using admins never get kicked out — the
// expiration window slides forward with each request.
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  const valid = isValidSession(token);
  const user = valid ? getSessionInfo(token) : null;

  const response = NextResponse.json({
    authenticated: valid,
    user,
  });

  if (valid) {
    const refreshed = refreshSessionToken(token, ADMIN_SESSION_MAX_AGE_MS);
    if (refreshed) {
      response.cookies.set("admin-session", refreshed, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: ADMIN_SESSION_MAX_AGE_SEC,
        path: "/",
      });
    }
  }

  return response;
}
