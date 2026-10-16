"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { errorMessage } from "@/lib/browser-upload";

export function Gate({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    const res = await fetch(`/api/g/${slug}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.refresh();
      return;
    }
    setError(await errorMessage(res, "Something went wrong."));
    setBusy(false);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm text-center">
        <Brand />
        <h1 className="display mt-8 text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-2 text-muted">This gallery is private. Enter the password you were given.</p>
        <form onSubmit={submit} className="mt-6 space-y-3 text-left">
          <label className="sr-only" htmlFor="gp">Password</label>
          <input id="gp" name="password" type="password" required autoFocus autoComplete="current-password" className="field" placeholder="Password" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Checking..." : "View gallery"}</button>
        </form>
      </div>
    </main>
  );
}
