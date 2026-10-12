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

  // The whole page is a drop target, not just the box.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [addFiles]);

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

  const active = jobs.filter((j) => j.status !== "done");
  const finished = jobs.length > 0 && done === jobs.length;

  return (
    <section>
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-white/80 p-6">
          <div className="rounded-2xl border-2 border-dashed border-accent bg-white px-10 py-8 text-center shadow-lg">
            <p className="display text-3xl">Drop to add photos</p>
            <p className="mt-1 text-sm text-muted">JPEG, PNG or WebP</p>
          </div>
        </div>
      )}
      <label
        className="card flex cursor-pointer flex-col items-center justify-center gap-1 border-dashed px-4 py-8 text-center"
      >
        <span className="display text-xl">Add photos</span>
        <span className="text-xs text-muted">Drop or click. JPEG, PNG, WebP. Originals kept untouched.</span>
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
      {skipped > 0 && <p className="mt-2 text-xs text-red-700">{skipped} file(s) skipped (not JPEG, PNG or WebP).</p>}

      {jobs.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              {finished ? `${done} uploaded` : `${done} of ${jobs.length} uploaded`}
              {failed.length ? `, ${failed.length} failed` : ""}
            </span>
            <span className="text-muted">{overall}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100} aria-label="Overall upload progress">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${overall}%` }} />
          </div>
          {failed.length > 0 && (
            <button className="btn mt-3 w-full" onClick={() => retry(failed.map((j) => j.id))}>
              Retry {failed.length} failed
            </button>
          )}
          {/* Finished files drop out of the list so it never grows with the batch. */}
          {active.length > 0 && (
            <ul className="mt-3 max-h-44 divide-y divide-line overflow-y-auto text-xs">
              {active.map((j) => (
                <li key={j.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate">{j.name}</span>
                  <span className="w-14 shrink-0 text-right">
                    {j.status === "error" ? (
                      <button className="text-red-700 underline" title={j.error} onClick={() => retry([j.id])}>Retry</button>
                    ) : j.status === "queued" ? (
                      <span className="text-muted">Waiting</span>
                    ) : (
                      <span className="block h-1 overflow-hidden rounded-full bg-line">
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
          )}
          {failed[0]?.error && <p className="mt-2 text-xs text-red-700">{failed[0].error}</p>}
        </div>
      )}
    </section>
  );
}
