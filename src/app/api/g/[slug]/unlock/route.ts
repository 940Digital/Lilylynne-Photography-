import { z } from "zod";
import { grantGalleryAccess } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { getGalleryBySlug, isExpired } from "@/lib/db";
import { fail, json, parseBody } from "@/lib/http";
import { clearRateLimit, clientIp, hitRateLimit } from "@/lib/ratelimit";

const schema = z.object({ password: z.string().min(1).max(200) });
const slugParam = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const slug = slugParam.safeParse((await ctx.params).slug);
  if (!slug.success) return fail(404, "Not found.");
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const limitKey = `gal:${clientIp(req)}:${slug.data}`;
  if (!(await hitRateLimit(limitKey, 10, 15 * 60))) {
    return fail(429, "Too many attempts. Please wait a few minutes.");
  }

  const g = await getGalleryBySlug(slug.data);
  if (!g || isExpired(g)) return fail(404, "Not found.");
  if (!g.password_hash || (await verifyPassword(data.password, g.password_hash))) {
    await clearRateLimit(limitKey);
    await grantGalleryAccess(g);
    return json({ ok: true });
  }
  return fail(401, "That password is not right.");
}
