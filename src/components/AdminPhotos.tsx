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

export function AdminPhotos({ galleryId, photos }: { galleryId: string; photos: AdminPhoto[] }) {
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
      <div className="mb-3 flex h-9 items-center justify-between gap-3">
        <h2 className="display text-2xl">
          Photos <span className="text-base text-muted">{photos.length}</span>
        </h2>
        {photos.length > 0 &&
          (selecting ? (
            <div className="flex items-center gap-2">
              <button className="btn btn-danger" disabled={!picked.size || busy} onClick={removePicked}>
                {busy ? "Deleting..." : `Delete ${picked.size || ""}`.trim()}
              </button>
              <button className="btn" onClick={stop}>Done</button>
            </div>
          ) : (
            <button className="btn" onClick={() => setSelecting(true)}>Select</button>
          ))}
      </div>

      {!photos.length ? (
        <p className="card p-8 text-center text-muted">No photos yet. Drop some in the box on the right.</p>
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
