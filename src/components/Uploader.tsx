"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, putBlob, resizeImage, withRetry } from "@/lib/browser-upload";
import { formatBytes } from "@/lib/format";

const CONCURRENCY = 3;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Status = "queued" | "resizing" | "uploading" | "done" | "error";
interface Job {
  id: number;
  name: string;
  size: number;
  status: Status;
  loaded: number; // bytes sent so far (original + preview + thumb)
  total: number;
  error?: string;
}

interface PresignResponse {
  photoId: string;
  urls: { original: string; preview: string; thumb: string };
}

export function Uploader({ galleryId, startOrder }: { galleryId: string; startOrder: number }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const [skipped, setSkipped] = useState(0);

  const files = useRef(new Map<number, File>());
  const orders = useRef(new Map<number, number>());
  const queue = useRef<number[]>([]);
  const running = useRef(0);
  const nextId = useRef(1);
  const nextOrder = useRef(startOrder);

  const patch = useCallback((id: number, p: Partial<Job>) => {
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...p } : j)));
  }, []);

  const runJob = useCallback(
    async (id: number) => {
      const file = files.current.get(id)!;
      let photoId: string | null = null;
      try {
        patch(id, { status: "resizing", loaded: 0, error: undefined });
        const img = await resizeImage(file);
        const total = file.size + img.preview.size + img.thumb.size;
        patch(id, { status: "uploading", total });

        const presign = await api<PresignResponse>(`/api/admin/galleries/${galleryId}/uploads`, "POST", {
          filename: file.name,
          contentType: file.type,
          originalBytes: file.size,
          previewBytes: img.preview.size,
          thumbBytes: img.thumb.size,
          width: img.width,
          height: img.height,
          sortOrder: orders.current.get(id) ?? 0,
        });
        photoId = presign.photoId;

        const sent = { o: 0, p: 0, t: 0 };
        const report = () => patch(id, { loaded: sent.o + sent.p + sent.t });
        await Promise.all([
          withRetry(() => putBlob(presign.urls.original, file, (n) => ((sent.o = n), report()))),
          withRetry(() => putBlob(presign.urls.preview, img.preview, (n) => ((sent.p = n), report()))),
          withRetry(() => putBlob(presign.urls.thumb, img.thumb, (n) => ((sent.t = n), report()))),
        ]);
        await api(`/api/admin/galleries/${galleryId}/uploads/complete`, "POST", { photoId });
        patch(id, { status: "done", loaded: total, total });
      } catch (e) {
        // Release the reserved space; a retry requests a fresh slot.
        if (photoId) api(`/api/admin/galleries/${galleryId}/photos/${photoId}`, "DELETE").catch(() => {});
        patch(id, { status: "error", error: e instanceof Error ? e.message : "Upload failed." });
      }
    },
    [galleryId, patch],
  );

  const pump = useCallback(() => {
    while (running.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      running.current++;
      runJob(id).finally(() => {
        running.current--;
        if (!queue.current.length && running.current === 0) router.refresh();
        pump();
      });
    }
  }, [runJob, router]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const all = Array.from(list);
      const good = all.filter((f) => ACCEPTED.includes(f.type));
      setSkipped(all.length - good.length);
      // Natural filename order so IMG_2 comes before IMG_10.
      good.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const added: Job[] = good.map((f) => {
        const id = nextId.current++;
        files.current.set(id, f);
        orders.current.set(id, nextOrder.current++);
        queue.current.push(id);
        return { id, name: f.name, size: f.size, status: "queued", loaded: 0, total: f.size };
      });
      setJobs((prev) => [...prev, ...added]);
      pump();
    },
    [pump],
  );

  function retry(ids: number[]) {
    for (const id of ids) {
      patch(id, { status: "queued", error: undefined, loaded: 0 });
      queue.current.push(id);
    }
    pump();
  }

  // Warn before closing the tab mid-upload.
  useEffect(() => {
    const busy = jobs.some((j) => j.status === "queued" || j.status === "resizing" || j.status === "uploading");
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [jobs]);

  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "error");
  const totalBytes = jobs.reduce((s, j) => s + j.total, 0);
  const loadedBytes = jobs.reduce((s, j) => s + (j.status === "done" ? j.total : j.loaded), 0);
  const overall = totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 0;

  return (
    <section>
      <label
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? "border-accent bg-white ring-2 ring-accent" : ""
        }`}
      >
        <span className="display text-2xl">Drop photos here</span>
        <span className="text-sm text-muted">or click to choose. JPEG, PNG or WebP. Originals are kept untouched.</span>
        <input
          data-testid="file-input"
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {skipped > 0 && <p className="mt-2 text-sm text-red-700">{skipped} file(s) skipped (not JPEG, PNG or WebP).</p>}

      {jobs.length > 0 && (
        <div className="card mt-4 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              {done} of {jobs.length} uploaded{failed.length ? `, ${failed.length} failed` : ""}
            </span>
            <span className="text-muted">{overall}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100} aria-label="Overall upload progress">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${overall}%` }} />
          </div>
          {failed.length > 0 && (
            <button className="btn mt-3" onClick={() => retry(failed.map((j) => j.id))}>
              Retry {failed.length} failed
            </button>
          )}
          <ul className="mt-4 max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">{j.name}</span>
                <span className="w-16 shrink-0 text-right text-muted">{formatBytes(j.size)}</span>
                <span className="w-32 shrink-0">
                  {j.status === "error" ? (
                    <button className="text-red-700 underline" title={j.error} onClick={() => retry([j.id])}>
                      Failed. Retry
                    </button>
                  ) : j.status === "done" ? (
                    <span className="text-green-700">Done</span>
                  ) : j.status === "queued" ? (
                    <span className="text-muted">Waiting</span>
                  ) : (
                    <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full bg-accent transition-[width]"
                        style={{ width: j.status === "resizing" ? "4%" : `${Math.round((j.loaded / j.total) * 100)}%` }}
                      />
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {failed[0]?.error && <p className="mt-2 text-sm text-red-700">{failed[0].error}</p>}
        </div>
      )}
    </section>
  );
}
