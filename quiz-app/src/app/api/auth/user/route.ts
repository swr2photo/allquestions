import { NextRequest, NextResponse } from "next/server";
import {
  verifyGoogleToken,
  createSessionToken,
  isValidSession,
  getSessionInfo,
  refreshSessionToken,
  USER_SESSION_MAX_AGE_MS,
  USER_SESSION_MAX_AGE_SEC,
  ADMIN_SESSION_MAX_AGE_MS,
  ADMIN_SESSION_MAX_AGE_SEC,
} from "@/lib/admin-store";

const isProd = process.env.NODE_ENV === "production";

// POST /api/auth/user - General User Google Sign-In
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

    // Notice: We do NOT check isAllowedAdminEmail here because any user can use AI

    const token = createSessionToken(
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

    // Token expiry & cookie maxAge now match — no more silent session drops.
    response.cookies.set("user-session", token, {
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

// DELETE /api/auth/user - Logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("user-session");
  return response;
}

// GET /api/auth/user - Check session + sliding refresh
//
// Admins can reuse their admin-session for user-facing endpoints; the
// cookie whose token is valid gets a fresh TTL re-issued on each request.
export async function GET(request: NextRequest) {
  const userToken = request.cookies.get("user-session")?.value;
  const adminToken = request.cookies.get("admin-session")?.value;

  const userValid = isValidSession(userToken);
  const adminValid = isValidSession(adminToken);

  const activeToken = userValid ? userToken : adminValid ? adminToken : undefined;
  const user = userValid
    ? getSessionInfo(userToken)
    : adminValid
      ? getSessionInfo(adminToken)
      : null;

  const response = NextResponse.json({
    authenticated: Boolean(activeToken),
    user,
  });

  // Slide each valid cookie's expiration forward.
  if (userValid) {
    const refreshed = refreshSessionToken(userToken, USER_SESSION_MAX_AGE_MS);
    if (refreshed) {
      response.cookies.set("user-session", refreshed, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: USER_SESSION_MAX_AGE_SEC,
        path: "/",
      });
    }
  }

  if (adminValid) {
    const refreshed = refreshSessionToken(adminToken, ADMIN_SESSION_MAX_AGE_MS);
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
