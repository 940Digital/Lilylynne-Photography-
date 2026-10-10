// Local stand-in for Cloudflare R2's S3 API, for development only. Speaks just enough S3:
// PUT, GET (with response-content-disposition), HEAD, DELETE, ListObjectsV2, DeleteObjects.
// It does NOT check signatures, but it does verify Content-MD5 on DeleteObjects like real S3.
// Usage: npm run mock-s3   (then set R2_ENDPOINT=http://localhost:9477 in .env.local)
import http from "node:http";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";

const ROOT = join(process.cwd(), ".data", "s3");
const PORT = Number(process.env.PORT ?? 9477);
const TYPES = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".zip": "application/zip" };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function walk(dir, base = "") {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`],
  );
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, HEAD, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "ETag");
    if (req.method === "OPTIONS") return res.writeHead(204).end();

    const [, bucket, ...rest] = decodeURIComponent(url.pathname).split("/");
    const key = rest.join("/");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const path = join(ROOT, bucket ?? "", key);

    try {
      if (req.method === "PUT") {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, body);
        return res.writeHead(200, { ETag: `"${createHash("md5").update(body).digest("hex")}"` }).end();
      }
      if (req.method === "POST" && url.searchParams.has("delete")) {
        const md5 = createHash("md5").update(body).digest("base64");
        if (req.headers["content-md5"] !== md5) return res.writeHead(400).end("<Error><Code>BadDigest</Code></Error>");
        for (const m of body.toString().matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
          const k = m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
          rmSync(join(ROOT, bucket, k), { force: true });
        }
        return res.writeHead(200, { "Content-Type": "application/xml" }).end("<DeleteResult></DeleteResult>");
      }
      if (req.method === "GET" && !key && url.searchParams.get("list-type") === "2") {
        const prefix = url.searchParams.get("prefix") ?? "";
        const max = Number(url.searchParams.get("max-keys") ?? 1000);
        const after = url.searchParams.get("continuation-token") ?? "";
        const all = walk(join(ROOT, bucket)).filter((k) => k.startsWith(prefix) && k > after).sort();
        const page = all.slice(0, max);
        const more = all.length > max;
        const xml =
          `<?xml version="1.0"?><ListBucketResult><IsTruncated>${more}</IsTruncated>` +
          page.map((k) => `<Contents><Key>${esc(k)}</Key><Size>${statSync(join(ROOT, bucket, k)).size}</Size></Contents>`).join("") +
          (more ? `<NextContinuationToken>${esc(page.at(-1))}</NextContinuationToken>` : "") +
          `</ListBucketResult>`;
        return res.writeHead(200, { "Content-Type": "application/xml" }).end(xml);
      }
      if (req.method === "DELETE") {
        rmSync(path, { force: true });
        return res.writeHead(204).end();
      }
      if (req.method === "GET" || req.method === "HEAD") {
        if (!key || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end("<Error><Code>NoSuchKey</Code></Error>");
        const size = statSync(path).size;
        const headers = { "Content-Type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream", "Content-Length": size };
        const cd = url.searchParams.get("response-content-disposition");
        if (cd) headers["Content-Disposition"] = cd;
        res.writeHead(200, headers);
        return res.end(req.method === "HEAD" ? undefined : readFileSync(path));
      }
      res.writeHead(405).end();
    } catch (e) {
      console.error(e);
      res.writeHead(500).end(String(e));
    }
  })
  .listen(PORT, () => console.log(`mock S3 on http://localhost:${PORT} (files in .data/s3)`));
