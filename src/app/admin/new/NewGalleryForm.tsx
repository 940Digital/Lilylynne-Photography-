"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/browser-upload";

export function NewGalleryForm({ defaultExpiry }: { defaultExpiry: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/galleries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.get("title"),
        clientName: f.get("clientName"),
        password: (f.get("password") as string) || undefined,
        expiresOn: f.get("expiresOn"),
      }),
    });
    if (res.ok) {
      const { id } = (await res.json()) as { id: string };
      router.push(`/admin/galleries/${id}`);
      return;
    }
    setError(await errorMessage(res, "Could not create the gallery."));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div>
        <label className="label" htmlFor="title">Gallery title</label>
        <input id="title" name="title" required maxLength={120} className="field" placeholder="Smith Wedding" />
      </div>
      <div>
        <label className="label" htmlFor="clientName">Client name</label>
        <input id="clientName" name="clientName" required maxLength={120} className="field" placeholder="Jordan and Casey Smith" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password (optional)</label>
        <input id="password" name="password" minLength={4} maxLength={100} autoComplete="off" className="field" placeholder="Leave empty for link-only access" />
      </div>
      <div>
        <label className="label" htmlFor="expiresOn">Expires on</label>
        <input id="expiresOn" name="expiresOn" type="date" required defaultValue={defaultExpiry} className="field" />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating..." : "Create gallery"}</button>
    </form>
  );
}
