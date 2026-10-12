import { hasGalleryAccess } from "@/lib/auth";
import { getGalleryBySlug, isExpired, listReadyPhotos } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { presignGet } from "@/lib/storage";
import { consumeUsage } from "@/lib/usage";

/** Signed URLs for every original, so the client's browser can build the zip itself. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) return fail(404, "Not found.");

  const g = await getGalleryBySlug(slug);
  if (!g || isExpired(g)) return fail(404, "Not found.");
  if (!(await hasGalleryAccess(g))) return fail(401, "Password required.");

  const photos = await listReadyPhotos(g.id);
  if (!photos.length) return fail(404, "No photos yet.");
  if (!(await consumeUsage("read", photos.length))) return fail(503, "Downloads are temporarily unavailable. Please try again later.");

  // Same name twice (IMG_1.jpg from two folders) would collide inside the zip.
  const seen = new Map<string, number>();
  const files = await Promise.all(
    photos.map(async (p) => {
      const n = (seen.get(p.filename) ?? 0) + 1;
      seen.set(p.filename, n);
      const dot = p.filename.lastIndexOf(".");
      const name = n === 1 ? p.filename : `${p.filename.slice(0, dot > 0 ? dot : undefined)}-${n}${dot > 0 ? p.filename.slice(dot) : ""}`;
      // Six hours covers a slow connection pulling a multi-GB gallery.
      return { name, bytes: p.size_bytes, url: await presignGet(p.original_key, { expiresSec: 6 * 3600 }) };
    }),
  );
  return json({ files, totalBytes: files.reduce((s, f) => s + f.bytes, 0) });
}
