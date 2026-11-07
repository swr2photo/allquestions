import crypto from "node:crypto";
import { kv } from "@/lib/kv";
import { STORE_KEY_PREFIX, sanitizeStore, type TimetableStore } from "@/lib/timetable-store";
import { SHARE_INDEX_PREFIX, SHARE_KEY_PREFIX, type ShareRecord } from "@/lib/timetable-share";

export async function loadUserStore(email: string): Promise<TimetableStore | null> {
  const raw = await kv.get<TimetableStore>(STORE_KEY_PREFIX + email);
  return raw ? sanitizeStore(raw) : null;
}

export async function loadShare(id: string): Promise<ShareRecord | null> {
  return (await kv.get<ShareRecord>(SHARE_KEY_PREFIX + id)) ?? null;
}

export async function loadOwnerShares(email: string): Promise<ShareRecord[]> {
  const ids = (await kv.get<string[]>(SHARE_INDEX_PREFIX + email)) ?? [];
  const recs = await Promise.all(ids.map((id) => loadShare(id)));
  return recs.filter((r): r is ShareRecord => !!r && r.owner === email);
}

export async function saveShare(rec: ShareRecord) {
  await kv.set(SHARE_KEY_PREFIX + rec.id, rec);
}

export async function saveOwnerIndex(email: string, ids: string[]) {
  await kv.set(SHARE_INDEX_PREFIX + email, ids);
}

export async function deleteShare(id: string) {
  await kv.del(SHARE_KEY_PREFIX + id);
}

export function newShareId(): string {
  return crypto.randomBytes(9).toString("base64url");
}
