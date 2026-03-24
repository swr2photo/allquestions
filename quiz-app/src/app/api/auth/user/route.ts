import { NextRequest, NextResponse } from "next/server";
import {
  verifyGoogleToken,
  createSessionToken,
  isValidSession,
  getSessionInfo,
} from "@/lib/admin-store";

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
    
    const token = createSessionToken({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
    });

    // Set as "user-session" cookie
    response.cookies.set("user-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
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
export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("user-session");
  return response;
}

// GET /api/auth/user - Check session
export async function GET(request: NextRequest) {
  // Check both user-session and admin-session (admins can also use AI)
  const userToken = request.cookies.get("user-session")?.value;
  const adminToken = request.cookies.get("admin-session")?.value;
  
  const token = userToken || adminToken;
  const valid = isValidSession(token);
  const user = getSessionInfo(token);

  return NextResponse.json({
    authenticated: valid,
    user: valid ? user : null,
  });
}
