import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { neon } from "@neondatabase/serverless";

type Params = unknown[];
interface Result<T> { rows: T[]; rowCount: number }
type Driver = <T>(text: string, params: Params) => Promise<Result<T>>;

const INT8 = 20; // Postgres type id for BIGINT / COUNT(*): the drivers hand it back as a string

function fixInt8<T>(rows: Record<string, unknown>[], fields: { name: string; dataTypeID: number }[]): T[] {
  const cols = fields.filter((f) => f.dataTypeID === INT8).map((f) => f.name);
  if (!cols.length) return rows as T[];
  return rows.map((r) => {
    const out = { ...r };
    for (const c of cols) if (out[c] != null) out[c] = Number(out[c]);
    return out;
  }) as T[];
}

let driver: Driver | undefined;
async function getDriver(): Promise<Driver> {
  if (driver) return driver;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing environment variable DATABASE_URL");

  if (url.startsWith("pglite:")) {
    // Local development only: an embedded Postgres in a folder. Never used on Vercel.
    const spec = "@electric-sql/pglite";
    const { PGlite } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ spec);
    const g = globalThis as { __pglite?: InstanceType<typeof PGlite> };
    const dir = url.slice("pglite://".length);
    mkdirSync(dirname(dir), { recursive: true });
    const db = (g.__pglite ??= new PGlite(dir));
    driver = async <T,>(text: string, params: Params) => {
      const r = await db.query(text, params);
      return { rows: fixInt8<T>(r.rows as Record<string, unknown>[], r.fields), rowCount: r.affectedRows ?? r.rows.length };
    };
  } else {
    const sql = neon(url);
    driver = async <T,>(text: string, params: Params) => {
      const r = await sql.query(text, params, { fullResults: true });
      return { rows: fixInt8<T>(r.rows, r.fields), rowCount: r.rowCount ?? r.rows.length };
    };
  }
  return driver;
}

/** Runs a statement and returns all rows. Use $1, $2 ... placeholders. */
export async function query<T = Record<string, unknown>>(text: string, params: Params = []): Promise<T[]> {
  return (await (await getDriver())<T>(text, params)).rows;
}

export async function queryOne<T = Record<string, unknown>>(text: string, params: Params = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

/** Runs a statement and returns how many rows it changed. */
export async function exec(text: string, params: Params = []): Promise<number> {
  return (await (await getDriver())(text, params)).rowCount;
}

export const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";

export interface Gallery {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  password_hash: string | null;
  created_at: number;
  expires_at: number;
  status: "active" | "expired";
  zip_key: string | null;
  zip_bytes: number;
  total_bytes: number;
  expiry_warned_at: number | null;
  purged_at: number | null;
}

export interface Photo {
  id: string;
  gallery_id: string;
  filename: string;
  original_key: string;
  preview_key: string;
  thumb_key: string;
  size_bytes: number;
  width: number;
  height: number;
  sort_order: number;
  status: "pending" | "ready";
  created_at: number;
}

export const nowSec = () => Math.floor(Date.now() / 1000);

export const isExpired = (g: Pick<Gallery, "status" | "expires_at">) => g.status === "expired" || g.expires_at <= nowSec();

export const getGalleryById = (id: string) => queryOne<Gallery>("SELECT * FROM galleries WHERE id = $1", [id]);

export const getGalleryBySlug = (slug: string) => queryOne<Gallery>("SELECT * FROM galleries WHERE slug = $1", [slug]);

export const listReadyPhotos = (galleryId: string) =>
  query<Photo>("SELECT * FROM photos WHERE gallery_id = $1 AND status = 'ready' ORDER BY sort_order, filename", [galleryId]);

export async function countActiveGalleries(): Promise<number> {
  const row = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM galleries WHERE status = 'active' AND expires_at > $1",
    [nowSec()],
  );
  return row?.n ?? 0;
}
