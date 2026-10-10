import { studio } from "@studio";
import { query, queryOne } from "./db";

// Counts how many R2 operations this app has caused each month, so it can stop before the
// free tier runs out. Reads are counted when a signed URL is issued, which is an upper bound
// on real fetches (the browser lazy-loads images it may never request).
export type UsageKind = "read" | "write";

const LIMITS: Record<UsageKind, number> = {
  read: studio.monthlyReadBudget,
  write: studio.monthlyWriteBudget,
};

const month = () => new Date().toISOString().slice(0, 7);

/** Adds `n` to this month's counter if that stays within budget. Returns false (and counts nothing) otherwise. */
export async function consumeUsage(kind: UsageKind, n: number): Promise<boolean> {
  if (n <= 0) return true;
  const rows = await query(
    `INSERT INTO usage (month, kind, count) VALUES ($1, $2, $3::bigint)
     ON CONFLICT (month, kind) DO UPDATE SET count = usage.count + $3::bigint
       WHERE usage.count + $3::bigint <= $4::bigint
     RETURNING count`,
    [month(), kind, n, LIMITS[kind]],
  );
  return rows.length > 0;
}

/** Counts operations that are not worth blocking on (admin previews, bookkeeping calls). */
export async function recordUsage(kind: UsageKind, n: number): Promise<void> {
  if (n <= 0) return;
  await query(
    `INSERT INTO usage (month, kind, count) VALUES ($1, $2, $3::bigint)
     ON CONFLICT (month, kind) DO UPDATE SET count = usage.count + $3::bigint`,
    [month(), kind, n],
  );
}

export async function currentUsage(): Promise<Record<UsageKind, number>> {
  const rows = await query<{ kind: UsageKind; count: number }>("SELECT kind, count FROM usage WHERE month = $1", [month()]);
  const out = { read: 0, write: 0 };
  for (const r of rows) out[r.kind] = r.count;
  return out;
}

/** Bytes stored across every gallery. */
export async function totalStoredBytes(): Promise<number> {
  const row = await queryOne<{ n: number }>("SELECT COALESCE(SUM(total_bytes), 0) AS n FROM galleries");
  return row?.n ?? 0;
}
