import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";
import { MAX_STORE_BYTES, emptyStore, mergeStores, sanitizeStore, type TimetableStore } from "@/lib/timetable-store";

export const dynamic = "force-dynamic";

const KEY_PREFIX = "timetable_store:v1:";

function sessionEmail(req: NextRequest): string | null {
  for (const name of ["user-session", "admin-session"]) {
    const token = req.cookies.get(name)?.value;
    if (token && isValidSession(token)) {
      const email = getSessionInfo(token)?.email;
      if (email) return email.toLowerCase();
    }
  }
  return null;
}

const noStore = { "Cache-Control": "no-store" };

// GET /api/timetable/store — the signed-in user's saved timetables, folders and prefs
export async function GET(req: NextRequest) {
  const email = sessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  try {
    const raw = await kv.get<TimetableStore>(KEY_PREFIX + email);
    return NextResponse.json({ store: raw ? sanitizeStore(raw) : null }, { headers: noStore });
  } catch (err) {
    console.error("[timetable store GET]", err);
    return NextResponse.json({ error: "โหลดข้อมูลจากฐานข้อมูลไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}

async function save(req: NextRequest) {
  const email = sessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });

  const text = await req.text();
  if (text.length > MAX_STORE_BYTES) {
    return NextResponse.json({ error: "ข้อมูลใหญ่เกินไป (ลบตารางที่ไม่ใช้แล้วก่อน)" }, { status: 413, headers: noStore });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore });
  }
  const incoming = sanitizeStore((body as { store?: unknown })?.store);

  try {
    const key = KEY_PREFIX + email;
    const existing = await kv.get<TimetableStore>(key);
    // merge server-side too, so two devices saving at once never drop each other's schedules
    const merged = mergeStores(existing ? sanitizeStore(existing) : emptyStore(), incoming);
    merged.updatedAt = Date.now();
    if (JSON.stringify(merged).length > MAX_STORE_BYTES) {
      return NextResponse.json({ error: "ข้อมูลใหญ่เกินไป (ลบตารางที่ไม่ใช้แล้วก่อน)" }, { status: 413, headers: noStore });
    }
    await kv.set(key, merged);
    return NextResponse.json({ store: merged }, { headers: noStore });
  } catch (err) {
    console.error("[timetable store PUT]", err);
    return NextResponse.json({ error: "บันทึกลงฐานข้อมูลไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}

export const PUT = save;
// POST is accepted too so the page can flush with fetch(keepalive) on tab close
export const POST = save;
