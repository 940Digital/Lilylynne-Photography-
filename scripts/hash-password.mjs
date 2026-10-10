// Usage: npm run hash-password -- "my password"
import { webcrypto as crypto } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "my password"');
  process.exit(1);
}
const ITER = 100000; // Workers caps PBKDF2 at 100000 iterations.
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
const b64 = (b) => Buffer.from(b).toString("base64url");
console.log(`pbkdf2:${ITER}:${b64(salt)}:${b64(new Uint8Array(bits))}`);
