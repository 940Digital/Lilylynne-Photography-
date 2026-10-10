// Applies db/schema.sql to DATABASE_URL (Neon) or a local PGlite folder (pglite://./.data/pg).
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first (Neon connection string, or pglite://./.data/pg for local).");
  process.exit(1);
}
const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

if (url.startsWith("pglite:")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = url.slice("pglite://".length);
  mkdirSync(dirname(dir), { recursive: true });
  const db = new PGlite(dir);
  await db.exec(sql);
  await db.close();
} else {
  const { neon } = await import("@neondatabase/serverless");
  const run = neon(url);
  // The HTTP driver takes one statement per call.
  for (const stmt of sql.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean)) {
    await run.query(stmt);
  }
}
console.log("Schema applied.");
