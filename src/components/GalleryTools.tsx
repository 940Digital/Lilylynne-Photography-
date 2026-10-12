"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, putBlob, withRetry } from "@/lib/browser-upload";
import { formatBytes } from "@/lib/format";

export function SettingsForm({ galleryId, expiresOn, hasPassword, onSaved }: { galleryId: string; expiresOn: string; hasPassword: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const f = new FormData(e.currentTarget);
    const body: Record<string, string> = { expiresOn: String(f.get("expiresOn")) };
    const pw = String(f.get("password") ?? "");
    if (pw) body.password = pw;
    try {
      await api(`/api/admin/galleries/${galleryId}`, "PATCH", body);
      setMsg("Saved.");
      (e.target as HTMLFormElement).reset();
      router.refresh();
      onSaved?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save.");
    }
    setBusy(false);
  }

  async function removePassword() {
    await api(`/api/admin/galleries/${galleryId}`, "PATCH", { password: "" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="s-exp">Expires on</label>
        <input id="s-exp" name="expiresOn" type="date" required defaultValue={expiresOn} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="s-pw">{hasPassword ? "Change password" : "Add a password"}</label>
        <input id="s-pw" name="password" minLength={4} maxLength={100} autoComplete="off" className="field" placeholder={hasPassword ? "New password" : "Optional"} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn btn-primary" disabled={busy}>Save</button>
        {hasPassword && (
          <button type="button" className="text-sm text-muted underline" onClick={removePassword}>Remove password</button>
        )}
        {msg && <span className="text-sm text-muted" role="status">{msg}</span>}
      </div>
    </form>
  );
}

export function ZipManager({ galleryId, zipName, zipBytes }: { galleryId: string; zipName: string | null; zipBytes: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function upload(file: File) {
    setErr("");
    setPct(0);
    try {
      const { key, url } = await api<{ key: string; url: string }>(`/api/admin/galleries/${galleryId}/zip`, "POST", {
        filename: file.name,
        bytes: file.size,
      });
      await withRetry(() => putBlob(url, file, (n) => setPct(Math.round((n / file.size) * 100))), 1);
      await api(`/api/admin/galleries/${galleryId}/zip`, "PUT", { key });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Zip upload failed.");
    }
    setPct(null);
  }

  async function remove() {
    if (!window.confirm("Remove the download-all zip?")) return;
    await api(`/api/admin/galleries/${galleryId}/zip`, "DELETE");
    router.refresh();
  }

  return (
    <div>
      {zipName ? (
        <p className="text-sm">
          <strong>{zipName}</strong> <span className="text-muted">({formatBytes(zipBytes)})</span>{" "}
          <button className="ml-2 text-muted underline" onClick={remove}>Remove</button>
        </p>
      ) : (
        <p className="text-sm text-muted">No zip yet. The client sees a Download all button once you add one.</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button className="btn" disabled={pct !== null} onClick={() => input.current?.click()}>
          {zipName ? "Replace zip" : "Upload zip"}
        </button>
        {pct !== null && <span className="text-sm text-muted">{pct}%</span>}
        <input
          ref={input}
          data-testid="zip-input"
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
    </div>
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
