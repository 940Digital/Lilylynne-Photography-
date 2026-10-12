"use client";

import { useRef } from "react";
import { DeleteGalleryButton, SettingsForm, ZipManager } from "@/components/GalleryTools";

interface Props {
  galleryId: string;
  title: string;
  photoCount: number;
  expiresOn: string;
  hasPassword: boolean;
  zipName: string | null;
  zipBytes: number;
}

// One Edit button holds every low-frequency control: expiry, password, zip, delete.
export function EditGallery(p: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="btn" onClick={() => dlg.current?.showModal()}>Edit</button>
      <dialog
        ref={dlg}
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-0 text-ink backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="display text-xl">Edit gallery</h2>
          <button className="text-sm text-muted underline" onClick={() => dlg.current?.close()}>Close</button>
        </div>
        <div className="space-y-6 p-5">
          <SettingsForm
            galleryId={p.galleryId}
            expiresOn={p.expiresOn}
            hasPassword={p.hasPassword}
            onSaved={() => dlg.current?.close()}
          />
          <div className="border-t border-line pt-5">
            <p className="label">Download-all zip</p>
            <ZipManager galleryId={p.galleryId} zipName={p.zipName} zipBytes={p.zipBytes} />
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
            <p className="text-sm text-muted">Deleting removes every photo and the client link.</p>
            <DeleteGalleryButton galleryId={p.galleryId} title={p.title} photoCount={p.photoCount} />
          </div>
        </div>
      </dialog>
    </>
  );
}
