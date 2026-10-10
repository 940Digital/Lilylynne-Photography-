import { z } from "zod";
import { studio } from "@studio";
import { exec, getGalleryById, queryOne, type Photo } from "@/lib/db";
import { fail, guardAdmin, idParam, json, parseBody } from "@/lib/http";
import { deleteKeys, headObject } from "@/lib/storage";
import { recordUsage } from "@/lib/usage";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ photoId: idParam });

/** Verifies the three objects really landed in R2, then reconciles reserved bytes with real sizes. */
export async function POST(req: Request, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Not found.");
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const g = await getGalleryById(id.data);
  if (!g) return fail(404, "Not found.");
  const photo = await queryOne<Photo>(
    "SELECT * FROM photos WHERE id = $1 AND gallery_id = $2 AND status = 'pending'",
    [data.photoId, g.id],
  );
  if (!photo) return fail(404, "Upload not found.");

  await recordUsage("read", 3);
  const [o, p, t] = await Promise.all([
    headObject(photo.original_key),
    headObject(photo.preview_key),
    headObject(photo.thumb_key),
  ]);
  if (!o || !p || !t) return fail(400, "One or more files did not finish uploading.");

  const actual = o.size + p.size + t.size;
  const delta = actual - photo.size_bytes;
  const tooBig = o.size > studio.maxOriginalBytes;

  // Apply the real size against the cap. A client that under-reported sizes gets rejected here.
  const bumped = tooBig
    ? 0
    : await exec(
        `UPDATE galleries SET total_bytes = GREATEST(0, total_bytes + $1::bigint)
         WHERE id = $2 AND total_bytes + $1::bigint <= $3::bigint
           AND (SELECT COALESCE(SUM(total_bytes), 0) FROM galleries) + $1::bigint <= $4::bigint`,
        [delta, g.id, studio.maxBytesPerGallery, studio.maxTotalBytes],
      );

  if (bumped === 0) {
    await deleteKeys([photo.original_key, photo.preview_key, photo.thumb_key]);
    await exec("DELETE FROM photos WHERE id = $1", [photo.id]);
    await exec("UPDATE galleries SET total_bytes = GREATEST(0, total_bytes - $1::bigint) WHERE id = $2", [photo.size_bytes, g.id]);
    return fail(413, tooBig ? "File is larger than the per-file limit." : "This gallery has reached its storage limit.");
  }

  await exec("UPDATE photos SET status = 'ready', size_bytes = $1 WHERE id = $2", [actual, photo.id]);
  return json({ ok: true });
}
