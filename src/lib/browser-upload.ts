// Browser-only helpers: resize images with canvas and PUT blobs straight to storage.

export const PREVIEW_EDGE = 2800;
export const THUMB_EDGE = 900;

export interface ResizedImage {
  width: number; // of the original, after EXIF rotation
  height: number;
  preview: Blob;
  thumb: Blob;
}

function toJpeg(source: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff"; // flatten transparent PNGs
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), "image/jpeg", quality),
  );
}

export async function resizeImage(file: File): Promise<ResizedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser could not read the image.");
  }
  try {
    const preview = await toJpeg(bitmap, PREVIEW_EDGE, 0.92);
    const thumb = await toJpeg(bitmap, THUMB_EDGE, 0.86);
    return { width: bitmap.width, height: bitmap.height, preview, thumb };
  } finally {
    bitmap.close();
  }
}

export function putBlob(url: string, body: Blob, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (body.type) xhr.setRequestHeader("Content-Type", body.type);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Network error during upload. Check the bucket CORS rules."));
    xhr.send(body);
  });
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
  }
}

export async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export async function api<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed (${res.status})`));
  return (await res.json()) as T;
}
