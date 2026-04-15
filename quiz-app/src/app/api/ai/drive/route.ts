import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";

// List files from Google Drive
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const accessToken = req.headers.get("x-drive-token");
  if (!accessToken) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง Drive" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const pageToken = searchParams.get("pageToken") || "";
  const folderId = searchParams.get("folderId") || "";
  const filter = searchParams.get("filter") || "all";

  // Build Drive API query
  let driveQuery = "trashed = false";

  // If browsing inside a folder, filter by parent
  if (folderId) {
    driveQuery += ` and '${folderId.replace(/'/g, "\\'")}' in parents`;
  }

  // Apply type filter
  if (filter === "docs") {
    driveQuery += " and mimeType = 'application/vnd.google-apps.document'";
  } else if (filter === "sheets") {
    driveQuery += " and mimeType = 'application/vnd.google-apps.spreadsheet'";
  } else if (filter === "pdf") {
    driveQuery += " and mimeType = 'application/pdf'";
  }
  // "all" and "notebooklm" show everything including folders
  if (query) {
    driveQuery += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  try {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", driveQuery);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,modifiedTime,iconLink,thumbnailLink,size)");
    url.searchParams.set("orderBy", "folder,modifiedTime desc");
    url.searchParams.set("pageSize", "30");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message || "ไม่สามารถเข้าถึง Drive ได้" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Drive List Error]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// Download/export a file from Google Drive
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("user-session") || cookieStore.get("admin-session");
  if (!userCookie) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const accessToken = req.headers.get("x-drive-token");
  if (!accessToken) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง Drive" }, { status: 403 });
  }

  try {
    const { fileId, mimeType } = await req.json();
    if (!fileId) {
      return NextResponse.json({ error: "ไม่ระบุไฟล์" }, { status: 400 });
    }

    // Google Workspace files need export, others use direct download
    const isGoogleDoc = mimeType?.startsWith("application/vnd.google-apps.");
    let downloadUrl: string;
    let exportMime: string | undefined;

    if (isGoogleDoc) {
      // Export Google Docs/Sheets/Slides to portable formats
      if (mimeType === "application/vnd.google-apps.document") {
        exportMime = "text/plain";
      } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
        exportMime = "text/csv";
      } else if (mimeType === "application/vnd.google-apps.presentation") {
        exportMime = "text/plain";
      } else {
        exportMime = "text/plain";
      }
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message || "ไม่สามารถดาวน์โหลดไฟล์ได้" },
        { status: res.status }
      );
    }

    // For text-based files, return as text
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text") || contentType.includes("json") || contentType.includes("csv")) {
      const text = await res.text();
      return NextResponse.json({ content: text, type: "text" });
    }

    // For binary files (PDF, images), return as base64
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return NextResponse.json({
      content: base64,
      type: "binary",
      mimeType: contentType,
    });
  } catch (err) {
    console.error("[Drive Download Error]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
