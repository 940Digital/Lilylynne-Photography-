const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 100000; // Workers caps PBKDF2 at 100000.

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// 12+ url-safe characters. 16 chars from a 56-letter alphabet is about 93 bits.
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomSlug(length = 16): string {
  const out: string[] = [];
  const limit = 256 - (256 % SLUG_ALPHABET.length); // reject to avoid modulo bias
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out.push(SLUG_ALPHABET[b % SLUG_ALPHABET.length]);
    }
  }
  return out.join("");
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

// Format: pbkdf2:<iterations>:<salt b64url>:<hash b64url>
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${b64url(salt)}:${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? "").split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  const hash = await pbkdf2(password, fromB64url(parts[2]), iterations);
  return timingSafeEqual(hash, fromB64url(parts[3]));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

// Gallery passwords are stored as plain text so the photographer can read them back in the
// admin. Older galleries still hold a pbkdf2 hash in the same column; both forms are accepted.
export const isHashedPassword = (stored: string | null | undefined) => !!stored && stored.startsWith("pbkdf2:");

export async function checkGalleryPassword(input: string, stored: string): Promise<boolean> {
  if (isHashedPassword(stored)) return verifyPassword(input, stored);
  return timingSafeEqual(enc.encode(input), enc.encode(stored));
}

export async function hmac(secret: string, data: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data)));
}

export async function hmacVerify(secret: string, data: string, sig: string): Promise<boolean> {
  const expected = fromB64url(await hmac(secret, data));
  try {
    return timingSafeEqual(expected, fromB64url(sig));
  } catch {
    return false;
  }
}

// Signed token: base64url(json).signature. `exp` (unix seconds) is always enforced.
export async function signToken(secret: string, payload: Record<string, unknown> & { exp: number }): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifyToken<T extends { exp: number }>(secret: string, token: string | undefined): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !(await hmacVerify(secret, body, sig))) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as T;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
