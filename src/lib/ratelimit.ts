import { exec, query } from "./db";

// Fixed-window limiter backed by Postgres. Atomic: one upsert returns the new count.
export async function hitRateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await query<{ count: number }>(
    `INSERT INTO rate_limits (key, count, window_start) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start <= $2 - $3::bigint THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start <= $2 - $3::bigint THEN $2 ELSE rate_limits.window_start END
     RETURNING count`,
    [key, now, windowSec],
  );
  return (rows[0]?.count ?? 1) <= max;
}

export async function clearRateLimit(key: string): Promise<void> {
  await exec("DELETE FROM rate_limits WHERE key = $1", [key]);
}

export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
