import { exec, queryOne, type Photo } from "@/lib/db";
import { fail, guardAdmin, idParam, json } from "@/lib/http";
import { deleteKeys } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

/** Removes one photo (also used to abort a failed upload). */
export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const params = await ctx.params;
  const id = idParam.safeParse(params.id);
  const photoId = idParam.safeParse(params.photoId);
  if (!id.success || !photoId.success) return fail(404, "Not found.");

  const photo = await queryOne<Photo>("SELECT * FROM photos WHERE id = $1 AND gallery_id = $2", [photoId.data, id.data]);
  if (!photo) return fail(404, "Not found.");

  await deleteKeys([photo.original_key, photo.preview_key, photo.thumb_key]);
  await exec("DELETE FROM photos WHERE id = $1", [photo.id]);
  await exec("UPDATE galleries SET total_bytes = GREATEST(0, total_bytes - $1::bigint) WHERE id = $2", [photo.size_bytes, photo.gallery_id]);
  return json({ ok: true });
}
