import { hasGalleryAccess } from "@/lib/auth";
import { getGalleryBySlug, isExpired } from "@/lib/db";
import { fail } from "@/lib/http";
import { presignGet } from "@/lib/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) return fail(404, "Not found.");

  const g = await getGalleryBySlug(slug);
  if (!g || isExpired(g) || !g.zip_key) return fail(404, "Not found.");
  if (!(await hasGalleryAccess(g))) return fail(401, "Password required.");

  const name = g.zip_key.split("/").pop() ?? "gallery.zip";
  const url = await presignGet(g.zip_key, { expiresSec: 600, downloadName: name });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
}
