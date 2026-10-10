import { hasGalleryAccess } from "@/lib/auth";
import { getGalleryBySlug, isExpired, queryOne, type Photo } from "@/lib/db";
import { fail, idParam } from "@/lib/http";
import { presignGet } from "@/lib/storage";

/** Auth-checks, then redirects to a short-lived signed URL that forces a download of the original. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; photoId: string }> }) {
  const params = await ctx.params;
  const photoId = idParam.safeParse(params.photoId);
  if (!photoId.success || !/^[A-Za-z0-9_-]{8,64}$/.test(params.slug)) return fail(404, "Not found.");

  const g = await getGalleryBySlug(params.slug);
  if (!g || isExpired(g)) return fail(404, "Not found.");
  if (!(await hasGalleryAccess(g))) return fail(401, "Password required.");

  const photo = await queryOne<Photo>(
    "SELECT * FROM photos WHERE id = $1 AND gallery_id = $2 AND status = 'ready'",
    [photoId.data, g.id],
  );
  if (!photo) return fail(404, "Not found.");

  const url = await presignGet(photo.original_key, { expiresSec: 300, downloadName: photo.filename });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
}
