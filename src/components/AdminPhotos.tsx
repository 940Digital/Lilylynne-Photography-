"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-upload";
import { formatBytes } from "@/lib/format";

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
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(p: AdminPhoto) {
    if (!window.confirm(`Delete ${p.filename}? This removes the original too.`)) return;
    setBusy(p.id);
    try {
      await api(`/api/admin/galleries/${galleryId}/photos/${p.id}`, "DELETE");
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!photos.length) return <p className="text-muted">No photos yet.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {photos.map((p) => (
        <li key={p.id} className="group relative overflow-hidden rounded-lg border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumbUrl} alt={p.filename} width={p.width} height={p.height} loading="lazy" className="aspect-square w-full object-cover" />
          <div className="p-2 text-xs">
            <p className="truncate">{p.filename}</p>
            <p className="text-muted">{formatBytes(p.bytes)}</p>
          </div>
          <button
            onClick={() => remove(p)}
            disabled={busy === p.id}
            className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-xs text-red-700 opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
