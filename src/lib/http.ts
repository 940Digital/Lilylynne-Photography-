import { z } from "zod";
import { isAdmin } from "./auth";

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const fail = (status: number, message: string) => json({ error: message }, status);

/** Parses and validates a JSON body. Returns either the data or a ready-to-return error response. */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error?: undefined } | { data?: undefined; error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: fail(400, "Request body must be JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: fail(400, `${first.path.join(".") || "body"}: ${first.message}`) };
  }
  return { data: parsed.data };
}

/**
 * Guard for admin API routes. Returns an error Response, or null when the request is allowed.
 * State-changing requests must also come from this site (Origin check on top of SameSite cookies).
 */
export async function guardAdmin(req: Request): Promise<Response | null> {
  if (!(await isAdmin())) return fail(401, "Not signed in.");
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== new URL(req.url).host) return fail(403, "Bad origin.");
  }
  return null;
}

export const idParam = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/);
