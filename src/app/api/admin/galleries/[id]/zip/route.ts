import { z } from "zod";
import { studio } from "@studio";
import { randomSlug } from "@/lib/crypto";
import { exec, getGalleryById, isExpired } from "@/lib/db";
import { fail, guardAdmin, idParam, json, parseBody } from "@/lib/http";
import { deleteKeys, galleryPrefix, headObject, presignPut } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const presignSchema = z.object({
  filename: z.string().trim().min(5).max(200).regex(/\.zip$/i, "Must be a .zip file"),
  bytes: z.number().int().min(1).max(studio.maxBytesPerGallery),
});
const completeSchema = z.object({ key: z.string().min(10).max(400) });

const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "gallery.zip";

async function load(req: Request, ctx: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return { error: denied };
  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) return { error: fail(404, "Not found.") };
  const g = await getGalleryById(id.data);
  if (!g || g.purged_at) return { error: fail(404, "Not found.") };
  return { g };
}

/** Step 1: presigned PUT for the zip. */
export async function POST(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  const { g } = r;
  if (isExpired(g)) return fail(409, "This gallery has expired.");
  const { data, error } = await parseBody(req, presignSchema);
  if (error) return error;

  if (g.total_bytes - g.zip_bytes + data.bytes > studio.maxBytesPerGallery) {
    return fail(413, "The zip would put this gallery over its storage limit.");
  }
  const key = `${galleryPrefix(g.id)}zip/${randomSlug(8)}/${safeName(data.filename)}`;
  return json({ key, url: await presignPut(key) });
}

/** Step 2: confirm the upload, swap it in, and delete any previous zip. */
export async function PUT(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  const { g } = r;
  const { data, error } = await parseBody(req, completeSchema);
  if (error) return error;
  if (!data.key.startsWith(`${galleryPrefix(g.id)}zip/`)) return fail(400, "key: wrong gallery.");

  const head = await headObject(data.key);
  if (!head) return fail(400, "The zip did not finish uploading.");

  const bumped = await exec(
    `UPDATE galleries SET total_bytes = total_bytes - zip_bytes + $1::bigint, zip_bytes = $1::bigint, zip_key = $2
     WHERE id = $3 AND total_bytes - zip_bytes + $1::bigint <= $4::bigint`,
    [head.size, data.key, g.id, studio.maxBytesPerGallery],
  );
  if (bumped === 0) {
    await deleteKeys([data.key]);
    return fail(413, "The zip would put this gallery over its storage limit.");
  }
  if (g.zip_key && g.zip_key !== data.key) await deleteKeys([g.zip_key]);
  return json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  const { g } = r;
  if (g.zip_key) await deleteKeys([g.zip_key]);
  await exec("UPDATE galleries SET total_bytes = GREATEST(0, total_bytes - zip_bytes), zip_bytes = 0, zip_key = NULL WHERE id = $1", [g.id]);
  return json({ ok: true });
}
