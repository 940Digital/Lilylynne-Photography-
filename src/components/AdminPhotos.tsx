"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-upload";

export interface AdminPhoto {
  id: string;
  filename: string;
  thumbUrl: string;
  bytes: number;
  width: number;
  height: number;
}

export function AdminPhotos({ galleryId, photos, coverId }: { galleryId: string; photos: AdminPhoto[]; coverId: string }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function stop() {
    setSelecting(false);
    setPicked(new Set());
  }

  async function makeCover() {
    const [id] = picked;
    if (picked.size !== 1 || !id) return;
    setBusy(true);
    try {
      await api(`/api/admin/galleries/${galleryId}`, "PATCH", { coverPhotoId: id });
      stop();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not set the cover.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function removePicked() {
    const n = picked.size;
    if (!n || !window.confirm(`Delete ${n} photo${n === 1 ? "" : "s"}? This removes the originals too.`)) return;
    setBusy(true);
    try {
      for (const id of picked) await api(`/api/admin/galleries/${galleryId}/photos/${id}`, "DELETE");
      stop();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div>
      {photos.length > 0 && (
        <div className="mb-3 flex h-8 items-center gap-2">
          {selecting ? (
            <>
              <button className="btn btn-sm btn-danger" disabled={!picked.size || busy} onClick={removePicked}>
                {busy ? "Deleting..." : `Delete ${picked.size || ""}`.trim()}
              </button>
              <button className="btn btn-sm" disabled={picked.size !== 1 || busy} onClick={makeCover}>Set as cover</button>
              <button className="btn btn-sm" onClick={stop}>Done</button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => setSelecting(true)}>Select</button>
          )}
        </div>
      )}

      {!photos.length ? (
        <p className="card p-8 text-center text-muted">No photos yet. Drop them anywhere on this page, or use Add photos.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
          {photos.map((p) => {
            const on = picked.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!selecting}
                  onClick={() => toggle(p.id)}
                  title={p.filename}
                  aria-pressed={selecting ? on : undefined}
                  className={`relative block w-full overflow-hidden rounded-lg ${on ? "ring-2 ring-accent ring-offset-2" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.filename} width={p.width} height={p.height} loading="lazy" className={`aspect-square w-full object-cover transition ${on ? "opacity-70" : ""}`} />
                  {p.id === coverId && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">Cover</span>
                  )}
                  {selecting && (
                    <span className={`absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border text-xs ${on ? "border-accent bg-accent text-white" : "border-white bg-black/20 text-transparent"}`}>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
