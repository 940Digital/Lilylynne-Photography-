import { z } from "zod";
import { exec, getGalleryById, nowSec, queryOne } from "@/lib/db";
import { endOfDay } from "@/lib/format";
import { fail, guardAdmin, idParam, json, parseBody } from "@/lib/http";
import { deletePrefix, galleryPrefix } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  clientName: z.string().trim().min(1).max(120).optional(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Empty string removes the password.
  password: z.string().max(100).optional(),
  // Photo id to use as the cover. Empty string goes back to the first photo.
  coverPhotoId: z.string().max(64).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Not found.");
  const { data, error } = await parseBody(req, patchSchema);
  if (error) return error;

  const g = await getGalleryById(id.data);
  if (!g) return fail(404, "Not found.");
  if (g.purged_at) return fail(409, "This gallery's files were already deleted.");

  if (data.title !== undefined) await exec("UPDATE galleries SET title = $1 WHERE id = $2", [data.title, g.id]);
  if (data.clientName !== undefined) await exec("UPDATE galleries SET client_name = $1 WHERE id = $2", [data.clientName, g.id]);
  if (data.expiresOn) {
    const expiresAt = endOfDay(data.expiresOn);
    if (!Number.isFinite(expiresAt) || expiresAt <= nowSec()) return fail(400, "expiresOn: must be in the future.");
    await exec("UPDATE galleries SET expires_at = $1, status = 'active', expiry_warned_at = NULL WHERE id = $2", [expiresAt, g.id]);
  }
  if (data.password !== undefined) {
    if (data.password && data.password.length < 4) return fail(400, "password: use at least 4 characters.");
    const hash = data.password || null; // plain text on purpose, see crypto.ts
    await exec("UPDATE galleries SET password_hash = $1 WHERE id = $2", [hash, g.id]);
  }
  if (data.coverPhotoId !== undefined) {
    if (data.coverPhotoId) {
      const own = await queryOne("SELECT id FROM photos WHERE id = $1 AND gallery_id = $2 AND status = 'ready'", [data.coverPhotoId, g.id]);
      if (!own) return fail(400, "coverPhotoId: that photo is not in this gallery.");
    }
    await exec("UPDATE galleries SET cover_photo_id = $1 WHERE id = $2", [data.coverPhotoId || null, g.id]);
  }
  return json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Not found.");

  const g = await getGalleryById(id.data);
  if (!g) return fail(404, "Not found.");

  // Files first: if this fails the rows stay, so the delete can simply be retried.
  const objects = await deletePrefix(galleryPrefix(g.id));
  await exec("DELETE FROM galleries WHERE id = $1", [g.id]); // photos go with it (ON DELETE CASCADE)
  return json({ ok: true, objectsDeleted: objects });
}
