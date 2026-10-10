import { z } from "zod";
import { studio } from "@studio";
import { randomSlug } from "@/lib/crypto";
import { exec, getGalleryById, isExpired, nowSec } from "@/lib/db";
import { fail, guardAdmin, idParam, json, parseBody } from "@/lib/http";
import { consumeUsage, totalStoredBytes } from "@/lib/usage";
import { galleryPrefix, presignPut } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(studio.allowedImageTypes),
  originalBytes: z.number().int().min(1).max(studio.maxOriginalBytes),
  previewBytes: z.number().int().min(1).max(30 * 1024 * 1024),
  thumbBytes: z.number().int().min(1).max(5 * 1024 * 1024),
  width: z.number().int().min(1).max(60000),
  height: z.number().int().min(1).max(60000),
  sortOrder: z.number().int().min(0).max(1_000_000),
});

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Reserves space (atomically, against the byte cap) and returns three presigned PUT URLs. */
export async function POST(req: Request, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Not found.");
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const g = await getGalleryById(id.data);
  if (!g || g.purged_at) return fail(404, "Not found.");
  if (isExpired(g)) return fail(409, "This gallery has expired. Extend its date to upload more.");

  const reserve = data.originalBytes + data.previewBytes + data.thumbBytes;
  // One statement checks and increments, so parallel uploads cannot overshoot the cap together.
  // Both caps (this gallery and the whole studio) are checked in the same statement.
  const bumped = await exec(
    `UPDATE galleries SET total_bytes = total_bytes + $1::bigint
     WHERE id = $2 AND total_bytes + $1::bigint <= $3::bigint
       AND (SELECT COALESCE(SUM(total_bytes), 0) FROM galleries) + $1::bigint <= $4::bigint`,
    [reserve, g.id, studio.maxBytesPerGallery, studio.maxTotalBytes],
  );
  if (bumped === 0) {
    const all = await totalStoredBytes();
    return fail(
      413,
      all + reserve > studio.maxTotalBytes
        ? "Studio storage limit reached. Delete an old gallery to free space before uploading more."
        : "This gallery has reached its storage limit.",
    );
  }
  // Three upload URLs plus the verify step later. Release the reservation if the monthly budget is spent.
  if (!(await consumeUsage("write", 3))) {
    await exec("UPDATE galleries SET total_bytes = GREATEST(0, total_bytes - $1::bigint) WHERE id = $2", [reserve, g.id]);
    return fail(429, "Monthly upload limit reached. Uploads resume next month.");
  }

  const photoId = randomSlug(20);
  const prefix = galleryPrefix(g.id);
  const keys = {
    original: `${prefix}o/${photoId}.${EXT[data.contentType]}`,
    preview: `${prefix}p/${photoId}.jpg`,
    thumb: `${prefix}t/${photoId}.jpg`,
  };
  try {
    await exec(
      `INSERT INTO photos (id, gallery_id, filename, original_key, preview_key, thumb_key, size_bytes, width, height, sort_order, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11)`,
      [photoId, g.id, data.filename, keys.original, keys.preview, keys.thumb, reserve, data.width, data.height, data.sortOrder, nowSec()],
    );
  } catch (e) {
    await exec("UPDATE galleries SET total_bytes = GREATEST(0, total_bytes - $1::bigint) WHERE id = $2", [reserve, g.id]);
    throw e;
  }

  const [original, preview, thumb] = await Promise.all([
    presignPut(keys.original),
    presignPut(keys.preview),
    presignPut(keys.thumb),
  ]);
  return json({ photoId, urls: { original, preview, thumb } });
}
