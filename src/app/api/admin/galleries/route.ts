import { z } from "zod";
import { studio } from "@studio";
import { hashPassword, randomSlug } from "@/lib/crypto";
import { countActiveGalleries, exec, isUniqueViolation, nowSec } from "@/lib/db";
import { endOfDay } from "@/lib/format";
import { fail, guardAdmin, json, parseBody } from "@/lib/http";

const createGallerySchema = z.object({
  title: z.string().trim().min(1).max(120),
  clientName: z.string().trim().min(1).max(120),
  password: z.string().max(100).optional(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd"),
});

export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const { data, error } = await parseBody(req, createGallerySchema);
  if (error) return error;

  const expiresAt = endOfDay(data.expiresOn);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowSec()) return fail(400, "expiresOn: must be in the future.");
  if (expiresAt > nowSec() + 3 * 365 * 86400) return fail(400, "expiresOn: at most 3 years out.");
  if (data.password && data.password.length < 4) return fail(400, "password: use at least 4 characters.");

  if ((await countActiveGalleries()) >= studio.maxActiveGalleries) {
    return fail(409, `Gallery limit reached (${studio.maxActiveGalleries}). Delete or let one expire first.`);
  }

  const id = crypto.randomUUID();
  const passwordHash = data.password ? await hashPassword(data.password) : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = randomSlug(16);
    try {
      await exec(
        `INSERT INTO galleries (id, slug, title, client_name, password_hash, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, slug, data.title, data.clientName, passwordHash, nowSec(), expiresAt],
      );
      return json({ id, slug }, 201);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // slug collision: try another
    }
  }
  return fail(500, "Could not allocate a gallery link. Try again.");
}
