import sharp from "sharp";
import { coverPhotoFor, getGalleryBySlug, isExpired } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { consumeUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The picture link previews (iMessage, WhatsApp, Slack) show. Public on purpose, so it works
// before the client types the password: it is the cover photo only, cropped to 1200x630.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) return new Response("Not found", { status: 404 });
  const g = await getGalleryBySlug(slug);
  if (!g || isExpired(g)) return new Response("Not found", { status: 404 });
  const photo = await coverPhotoFor(g);
  if (!photo || !(await consumeUsage("read", 1))) return new Response("Not found", { status: 404 });

  const src = await fetch(await presignGet(photo.preview_key, { expiresSec: 300 }));
  if (!src.ok) return new Response("Not found", { status: 404 });
  const jpeg = await sharp(Buffer.from(await src.arrayBuffer()))
    .rotate()
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "X-Robots-Tag": "noindex",
    },
  });
}
