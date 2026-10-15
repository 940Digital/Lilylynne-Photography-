"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-upload";

export function SettingsForm({
  galleryId,
  title,
  clientName,
  expiresOn,
  password,
  hasLegacyPassword,
  onSaved,
}: {
  galleryId: string;
  title: string;
  clientName: string;
  expiresOn: string;
  password: string;
  hasLegacyPassword: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Older galleries hold an unreadable hash: blank means "leave it" unless Remove was pressed.
  const [clearLegacy, setClearLegacy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const f = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      title: String(f.get("title")),
      clientName: String(f.get("clientName")),
      expiresOn: String(f.get("expiresOn")),
    };
    const pw = String(f.get("password") ?? "").trim();
    if (hasLegacyPassword && !clearLegacy) {
      if (pw) body.password = pw;
    } else {
      body.password = pw; // blank removes it
    }
    try {
      await api(`/api/admin/galleries/${galleryId}`, "PATCH", body);
      setClearLegacy(false);
      router.refresh();
      onSaved?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save.");
    }
    setBusy(false);
  }

  const legacyKept = hasLegacyPassword && !clearLegacy;

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="s-title">Gallery name</label>
        <input id="s-title" name="title" required maxLength={120} defaultValue={title} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="s-client">Client</label>
        <input id="s-client" name="clientName" required maxLength={120} defaultValue={clientName} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="s-exp">Expires on</label>
        <input id="s-exp" name="expiresOn" type="date" required defaultValue={expiresOn} className="field" />
      </div>
      <div>
        <label className="label flex justify-between" htmlFor="s-pw">
          <span>Password</span>
          {legacyKept && (
            <button type="button" className="underline" onClick={() => setClearLegacy(true)}>Remove</button>
          )}
        </label>
        <input
          key={password}
          id="s-pw"
          name="password"
          minLength={4}
          maxLength={100}
          autoComplete="off"
          defaultValue={password}
          className="field"
          placeholder={legacyKept ? "Set (hidden). Type a new one" : "None. Leave blank for no password"}
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn btn-primary" disabled={busy}>Save</button>
        {msg && <span className="text-sm text-muted" role="status">{msg}</span>}
      </div>
    </form>
  );
}

export function DeleteGalleryButton({ galleryId, title, photoCount }: { galleryId: string; title: string; photoCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    const ok = window.confirm(
      `Delete "${title}"?\n\nThis permanently removes ${photoCount} photos, the originals, and the client link. It cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/admin/galleries/${galleryId}`, "DELETE");
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed.");
      setBusy(false);
    }
  }
  return (
    <button className="btn btn-danger" onClick={del} disabled={busy}>
      {busy ? "Deleting..." : "Delete gallery"}
    </button>
  );
}
