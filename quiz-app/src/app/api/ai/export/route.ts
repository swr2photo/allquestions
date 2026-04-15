import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

function findPython(): string {
  const home = os.homedir();
  const versions = ["Python310", "Python311", "Python312", "Python313"];

  // Try short path first (handles spaces in Windows usernames like "This PC" -> "THISPC~1")
  const shortHome = home.replace(/\\([^\\]+)$/, (_, name) => {
    // Generate 8.3 short name: remove spaces, take first 6 chars + ~1
    const short = name.replace(/\s+/g, "").substring(0, 6).toUpperCase() + "~1";
    return "\\" + short;
  });

  for (const h of [shortHome, home]) {
    for (const ver of versions) {
      const p = path.join(h, "AppData", "Local", "Programs", "Python", ver, "python.exe");
      try { if (fs.existsSync(p)) return p; } catch {}
    }
  }
  return "python";
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const { content, title, format } = await req.json();

    if (!content || !format || !["docx", "pdf"].includes(format)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Limit content size to 500KB to prevent abuse
    if (typeof content !== "string" || content.length > 500_000) {
      return NextResponse.json({ error: "Content too large (max 500KB)" }, { status: 400 });
    }

    const scriptPath = path.resolve(process.cwd(), "scripts", "generate_doc.py");
    const pythonPath = findPython();
    const inputJson = JSON.stringify({ content, title: title || "", format });

    console.log("[Export] Python:", pythonPath);

    const result = await new Promise<string>((resolve, reject) => {
      // Use spawn with shell=false, pass args as array - handles spaces in path
      const child = spawn(pythonPath, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("error", (err: Error) => {
        reject(new Error(`Python not found: ${err.message}`));
      });

      child.on("close", (code: number) => {
        if (code !== 0) {
          console.error("[Export stderr]", stderr);
          console.error("[Export stdout]", stdout.slice(0, 500));
          // Try to extract error from stdout (Python script outputs JSON error)
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.error) {
              reject(new Error(parsed.error));
              return;
            }
          } catch {}
          reject(new Error(stderr || `Python exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });

      // Write JSON to stdin
      child.stdin.write(inputJson);
      child.stdin.end();
    });

    const parsed = JSON.parse(result);
    if (parsed.error) throw new Error(parsed.error);

    const buffer = Buffer.from(parsed.data, "base64");
    const mimeType = format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent((title || "document") + "." + format)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("[Export Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ไม่สามารถสร้างไฟล์ได้" },
      { status: 500 }
    );
  }
}
