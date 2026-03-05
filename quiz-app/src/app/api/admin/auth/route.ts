import { NextRequest, NextResponse } from "next/server";
import {
  verifyGoogleToken,
  isAllowedAdminEmail,
  createSessionToken,
  addSession,
  removeSession,
  isValidSession,
  getSessionInfo,
} from "@/lib/admin-store";

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

    const token = createSessionToken();
    addSession(token, {
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

    response.cookies.set("admin-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
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
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  if (token) {
    removeSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("admin-session");
  return response;
}

// GET /api/admin/auth - Check session
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-session")?.value;
  const valid = isValidSession(token);
  const user = getSessionInfo(token);

  return NextResponse.json({
    authenticated: valid,
    user: valid ? user : null,
  });
}
