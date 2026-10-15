import { hasGalleryAccess } from "@/lib/auth";
import { getGalleryBySlug, isExpired, queryOne, type Photo } from "@/lib/db";
import { fail, idParam } from "@/lib/http";
import { presignGet } from "@/lib/storage";
import { consumeUsage } from "@/lib/usage";

// One original per request, streamed through. Only used when the browser cannot read storage
// directly (bucket CORS missing), so Download all works with no storage setup at all.
export const maxDuration = 300;

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
  if (!(await consumeUsage("read", 1))) return fail(503, "Downloads are temporarily unavailable. Please try again later.");

  const upstream = await fetch(await presignGet(photo.original_key, { expiresSec: 600 }));
  if (!upstream.ok || !upstream.body) return fail(502, "Storage did not return the photo.");

  const headers: Record<string, string> = { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" };
  const len = upstream.headers.get("content-length");
  if (len) headers["Content-Length"] = len;
  return new Response(upstream.body, { headers });
}
