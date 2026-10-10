import { studio } from "@studio";
import { exec, nowSec, query } from "./db";
import type { Gallery } from "./db";
import { deleteKeys, deletePrefix, galleryPrefix } from "./storage";

const DAY = 86400;

/** Daily maintenance. Called by the Vercel cron at /api/cron/daily. */
export async function runDailyMaintenance(log: (msg: string) => void = console.log) {
  const now = nowSec();

  // 1. Mark galleries past their expiry date.
  const marked = await exec("UPDATE galleries SET status = 'expired' WHERE status = 'active' AND expires_at <= $1", [now]);
  log(`expiry: marked ${marked} gallery(ies) expired`);

  // 2. Reminder log a few days before expiry.
  // TODO: send this as an email to studio.adminContactEmail (Resend is already set up for the contact form).
  const soon = await query<Gallery>(
    "SELECT * FROM galleries WHERE status = 'active' AND expiry_warned_at IS NULL AND expires_at <= $1",
    [now + studio.warnDaysBeforeExpiry * DAY],
  );
  for (const g of soon) {
    const days = Math.max(0, Math.ceil((g.expires_at - now) / DAY));
    log(`expiry: REMINDER "${g.title}" (${g.client_name}) expires in ${days} day(s). Notify ${studio.adminContactEmail}.`);
    await exec("UPDATE galleries SET expiry_warned_at = $1 WHERE id = $2", [now, g.id]);
  }

  // 3. Delete files of galleries that have been expired longer than the grace period.
  const due = await query<Gallery>(
    "SELECT * FROM galleries WHERE status = 'expired' AND purged_at IS NULL AND expires_at <= $1",
    [now - studio.purgeGraceDays * DAY],
  );
  for (const g of due) {
    const n = await deletePrefix(galleryPrefix(g.id));
    await exec("DELETE FROM photos WHERE gallery_id = $1", [g.id]);
    await exec("UPDATE galleries SET zip_key = NULL, zip_bytes = 0, total_bytes = 0, purged_at = $1 WHERE id = $2", [now, g.id]);
    log(`expiry: purged "${g.title}" (${n} objects)`);
  }

  // 4. Drop upload reservations that never completed (older than a day).
  const stale = await query<{ id: string; original_key: string; preview_key: string; thumb_key: string }>(
    "SELECT id, original_key, preview_key, thumb_key FROM photos WHERE status = 'pending' AND created_at < $1",
    [now - DAY],
  );
  for (const p of stale) {
    await deleteKeys([p.original_key, p.preview_key, p.thumb_key]);
    await exec("DELETE FROM photos WHERE id = $1", [p.id]);
  }
  if (stale.length) {
    await exec(
      `UPDATE galleries SET total_bytes =
         (SELECT COALESCE(SUM(size_bytes), 0) FROM photos WHERE gallery_id = galleries.id) + zip_bytes
       WHERE purged_at IS NULL`,
    );
    log(`expiry: removed ${stale.length} abandoned upload(s)`);
  }

  // 5. Old rate limit rows.
  await exec("DELETE FROM rate_limits WHERE window_start < $1", [now - DAY]);
}
