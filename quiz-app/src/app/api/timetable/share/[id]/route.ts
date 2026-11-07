import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/session.server";
import { SHARE_ID_RE, resolveShare } from "@/lib/timetable-share";
import { loadShare, loadUserStore } from "@/lib/timetable-share.server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

// GET /api/timetable/share/<id>[?since=<updatedAt>] — the latest saved version of a shared timetable.
// Signed-in users only (course data is too). `since` lets viewers poll cheaply.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = sessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  const { id } = await params;
  if (!SHARE_ID_RE.test(id)) {
    return NextResponse.json({ error: "ไม่พบลิงก์แชร์นี้" }, { status: 404, headers: noStore });
  }
  try {
    const rec = await loadShare(id);
    if (!rec) {
      return NextResponse.json({ error: "ไม่พบลิงก์แชร์นี้ หรือเจ้าของยกเลิกการแชร์แล้ว" }, { status: 404, headers: noStore });
    }
    const live = resolveShare(rec, await loadUserStore(rec.owner));
    if (!live) {
      return NextResponse.json({ error: "เจ้าของลบตารางต้นฉบับไปแล้ว" }, { status: 410, headers: noStore });
    }
    const since = Number(req.nextUrl.searchParams.get("since"));
    if (since && since === live.updatedAt) {
      return NextResponse.json({ unchanged: true, updatedAt: live.updatedAt }, { headers: noStore });
    }
    return NextResponse.json({ share: { ...live, isOwner: rec.owner === user.email } }, { headers: noStore });
  } catch (err) {
    console.error("[timetable share/:id GET]", err);
    return NextResponse.json({ error: "โหลดตารางที่แชร์ไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}
