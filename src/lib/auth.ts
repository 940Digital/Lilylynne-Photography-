import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Gallery } from "./db";
import { env } from "./env";
import { signToken, verifyPassword, verifyToken, timingSafeEqual } from "./crypto";

const ADMIN_COOKIE = "admin_session";
const ADMIN_TTL = 7 * 86400;
const GALLERY_TTL = 7 * 86400;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function checkAdminCredentials(email: string, password: string): Promise<boolean> {
  const enc = new TextEncoder();
  const emailOk = timingSafeEqual(enc.encode(email.trim().toLowerCase()), enc.encode(env.adminEmail.trim().toLowerCase()));
  // Always run the hash so response time does not reveal whether the email matched.
  const passOk = await verifyPassword(password, env.adminPasswordHash);
  return emailOk && passOk;
}

export async function startAdminSession(): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_TTL;
  const token = await signToken(env.sessionSecret, { role: "admin", exp });
  (await cookies()).set(ADMIN_COOKIE, token, { ...cookieBase, maxAge: ADMIN_TTL });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = await verifyToken<{ role: string; exp: number }>(env.sessionSecret, token);
  return payload?.role === "admin";
}

/** For server components under /admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** Per-gallery access cookie, issued after a correct gallery password. */
const galleryCookie = (slug: string) => `gal_${slug}`;
const passwordStamp = (g: Gallery) => (g.password_hash ?? "").slice(-12);

export async function grantGalleryAccess(g: Gallery): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + GALLERY_TTL;
  const token = await signToken(env.sessionSecret, { slug: g.slug, ph: passwordStamp(g), exp });
  (await cookies()).set(galleryCookie(g.slug), token, { ...cookieBase, maxAge: GALLERY_TTL, path: "/" });
}

export async function hasGalleryAccess(g: Gallery): Promise<boolean> {
  if (!g.password_hash) return true;
  const token = (await cookies()).get(galleryCookie(g.slug))?.value;
  const payload = await verifyToken<{ slug: string; ph: string; exp: number }>(env.sessionSecret, token);
  // The stamp ties the cookie to the current password, so changing it logs everyone out.
  return payload?.slug === g.slug && payload.ph === passwordStamp(g);
}
