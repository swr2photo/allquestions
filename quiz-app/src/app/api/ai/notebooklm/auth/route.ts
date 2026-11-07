import { NextResponse } from "next/server";
import { exec } from "child_process";
import os from "os";
import fs from "fs";
import { join } from "path";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";

async function requireAdmin() {
  const token = (await cookies()).get("admin-session")?.value;
  return isValidSession(token);
}

// POST: Run notebooklm-mcp-server auth (opens browser)
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const cacheDir = join(os.tmpdir(), `npm-cache-nlm-${Date.now()}`);
    console.log("[NotebookLM Auth] Starting auth process...");
    const command = `npx --yes notebooklm-mcp-server auth`;
    const child = exec(command, {
      env: { ...process.env, npm_config_cache: cacheDir, NPM_CONFIG_CACHE: cacheDir },
    });
    child.unref();

    return NextResponse.json({
      success: true,
      message: "เปิดหน้าต่างเบราว์เซอร์เพื่อล็อกอินแล้ว เมื่อเสร็จให้กด Refresh",
    });
  } catch (err) {
    console.error("[NotebookLM Auth]", err);
    return NextResponse.json({ error: "ไม่สามารถเปิดหน้า login ได้" }, { status: 500 });
  }
}

// GET: Check auth status
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const authPath = join(os.homedir(), ".notebooklm-mcp", "auth.json");
    if (!fs.existsSync(authPath)) {
      return NextResponse.json({ authenticated: false, reason: "no_file" });
    }
    const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
    const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
    const hasCookies = !!data.cookies && data.cookies.length > 100;
    const ageHours = updatedAt ? (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60) : 999;

    return NextResponse.json({
      authenticated: hasCookies,
      fresh: ageHours < 24,
      ageHours: Math.round(ageHours),
      updatedAt: updatedAt?.toISOString() || null,
    });
  } catch {
    return NextResponse.json({ authenticated: false, reason: "read_error" });
  }
}
