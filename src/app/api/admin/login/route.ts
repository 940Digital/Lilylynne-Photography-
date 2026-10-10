import { z } from "zod";
import { checkAdminCredentials, startAdminSession } from "@/lib/auth";
import { fail, json, parseBody } from "@/lib/http";
import { clearRateLimit, clientIp, hitRateLimit } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const limitKey = `login:${clientIp(req)}`;
  if (!(await hitRateLimit(limitKey, 8, 15 * 60))) {
    return fail(429, "Too many attempts. Try again in 15 minutes.");
  }

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  if (!(await checkAdminCredentials(data.email, data.password))) {
    return fail(401, "Wrong email or password.");
  }
  await clearRateLimit(limitKey);
  await startAdminSession();
  return json({ ok: true });
}
