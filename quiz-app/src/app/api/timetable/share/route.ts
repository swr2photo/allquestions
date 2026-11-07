import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/session.server";
import {
  MAX_SHARES_PER_USER,
  SHARE_ID_RE,
  parseSource,
  resolveShare,
  sameSource,
  termLabelOf,
  type ShareRecord,
  type ShareSummary,
} from "@/lib/timetable-share";
import {
  deleteShare,
  loadOwnerShares,
  loadUserStore,
  newShareId,
  saveOwnerIndex,
  saveShare,
} from "@/lib/timetable-share.server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });

async function summaries(email: string): Promise<ShareSummary[]> {
  const [recs, store] = await Promise.all([loadOwnerShares(email), loadUserStore(email)]);
  return recs
    .map((r) => {
      const live = resolveShare(r, store);
      const termId = live?.termId ?? (r.source.kind === "working" ? r.source.termId : "");
      return {
        id: r.id,
        source: r.source,
        includeCustom: r.includeCustom,
        showName: r.showName,
        createdAt: r.createdAt,
        name: live?.name ?? "ตารางที่ถูกลบแล้ว",
        termId,
        termLabel: live?.termLabel ?? termLabelOf(termId),
        updatedAt: live?.updatedAt ?? 0,
        missing: !live,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

// GET /api/timetable/share — the signed-in user's live share links
export async function GET(req: NextRequest) {
  const user = sessionUser(req);
  if (!user) return unauthorized();
  try {
    return NextResponse.json({ shares: await summaries(user.email) }, { headers: noStore });
  } catch (err) {
    console.error("[timetable share GET]", err);
    return NextResponse.json({ error: "โหลดลิงก์ที่แชร์ไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}

// POST /api/timetable/share { source, includeCustom?, showName? } — create (or reuse) a live link
export async function POST(req: NextRequest) {
  const user = sessionUser(req);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore });
  }
  const source = parseSource(body.source);
  if (!source) return NextResponse.json({ error: "ไม่พบตารางที่จะแชร์" }, { status: 400, headers: noStore });
  const includeCustom = body.includeCustom === true;
  const showName = body.showName !== false;

  try {
    const recs = await loadOwnerShares(user.email);
    const existing = recs.find((r) => sameSource(r.source, source));
    let rec: ShareRecord;
    if (existing) {
      rec = { ...existing, includeCustom, showName, ownerName: user.name || existing.ownerName };
    } else {
      if (recs.length >= MAX_SHARES_PER_USER) {
        return NextResponse.json(
          { error: `แชร์ได้สูงสุด ${MAX_SHARES_PER_USER} ลิงก์ — ยกเลิกลิงก์เก่าที่ไม่ใช้ก่อน` },
          { status: 400, headers: noStore }
        );
      }
      rec = { id: newShareId(), owner: user.email, ownerName: user.name || undefined, source, includeCustom, showName, createdAt: Date.now() };
      await saveOwnerIndex(user.email, [...recs.map((r) => r.id), rec.id]);
    }
    await saveShare(rec);
    return NextResponse.json({ id: rec.id, shares: await summaries(user.email) }, { headers: noStore });
  } catch (err) {
    console.error("[timetable share POST]", err);
    return NextResponse.json({ error: "สร้างลิงก์แชร์ไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}

// DELETE /api/timetable/share?id=… — revoke a link (anyone holding it loses access)
export async function DELETE(req: NextRequest) {
  const user = sessionUser(req);
  if (!user) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!SHARE_ID_RE.test(id)) return NextResponse.json({ error: "ไม่พบลิงก์" }, { status: 404, headers: noStore });
  try {
    const recs = await loadOwnerShares(user.email);
    if (!recs.some((r) => r.id === id)) return NextResponse.json({ error: "ไม่พบลิงก์" }, { status: 404, headers: noStore });
    await deleteShare(id);
    await saveOwnerIndex(
      user.email,
      recs.filter((r) => r.id !== id).map((r) => r.id)
    );
    return NextResponse.json({ ok: true, shares: await summaries(user.email) }, { headers: noStore });
  } catch (err) {
    console.error("[timetable share DELETE]", err);
    return NextResponse.json({ error: "ยกเลิกลิงก์ไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}
