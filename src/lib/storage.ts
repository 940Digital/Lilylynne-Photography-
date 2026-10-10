import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { env } from "./env";

// Cloudflare R2 over its S3-compatible API. Presigned URLs go to the browser;
// head, list and delete run server-side with the same credentials.
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const xmlUnescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

let client: AwsClient | undefined;
const aws = () =>
  (client ??= new AwsClient({
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
    service: "s3",
    region: "auto",
  }));

const bucketUrl = () => `${env.r2.endpoint}/${env.r2.bucket}`;
const objectUrl = (key: string) => `${bucketUrl()}/${encodeKey(key)}`;

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function presign(method: "GET" | "PUT", key: string, expiresSec: number, downloadName?: string): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresSec));
  // Forces a download (instead of inline display) with the original file name.
  if (downloadName) url.searchParams.set("response-content-disposition", contentDisposition(downloadName));
  const signed = await aws().sign(new Request(url, { method }), { aws: { signQuery: true } });
  return signed.url;
}

export const presignGet = (key: string, opts: { expiresSec?: number; downloadName?: string } = {}) =>
  presign("GET", key, opts.expiresSec ?? 3600, opts.downloadName);

export const presignPut = (key: string, expiresSec = 3600) => presign("PUT", key, expiresSec);

/** Size in bytes, or null when the object does not exist. */
export async function headObject(key: string): Promise<{ size: number } | null> {
  const res = await aws().fetch(objectUrl(key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD failed (${res.status})`);
  return { size: Number(res.headers.get("content-length") ?? 0) };
}

/** Deletes up to 1000 keys per request. Missing keys are not an error. */
export async function deleteKeys(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const body =
      `<Delete><Quiet>true</Quiet>${batch.map((k) => `<Object><Key>${xmlEscape(k)}</Key></Object>`).join("")}</Delete>`;
    const res = await aws().fetch(`${bucketUrl()}?delete`, {
      method: "POST",
      headers: { "Content-Type": "application/xml", "Content-MD5": createHash("md5").update(body).digest("base64") },
      body,
    });
    const text = await res.text();
    if (!res.ok || text.includes("<Error>")) throw new Error(`R2 delete failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(bucketUrl());
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("max-keys", "1000");
    if (token) url.searchParams.set("continuation-token", token);
    const res = await aws().fetch(url.toString());
    const xml = await res.text();
    if (!res.ok) throw new Error(`R2 list failed (${res.status}): ${xml.slice(0, 300)}`);
    for (const m of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) keys.push(xmlUnescape(m[1]));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xmlUnescape(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? "")
      : undefined;
  } while (token);
  return keys;
}

/** Deletes every object under a prefix and returns how many were removed. */
export async function deletePrefix(prefix: string): Promise<number> {
  const keys = await listKeys(prefix);
  await deleteKeys(keys);
  return keys.length;
}

export const galleryPrefix = (galleryId: string) => `g/${galleryId}/`;
