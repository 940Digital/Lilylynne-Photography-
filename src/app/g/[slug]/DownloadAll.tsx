"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/format";

interface FileList {
  files: { name: string; url: string; bytes: number }[];
  totalBytes: number;
}

type SaveHandle = { createWritable(): Promise<WritableStream<Uint8Array>> };
type SavePicker = (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle>;

// Browsers without a save-to-disk stream (Safari, Firefox) must hold the zip in memory.
const MEMORY_LIMIT = 1.5 * 1024 ** 3;

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "gallery";

/**
 * Builds the zip in the visitor's browser: originals stream from storage straight into an
 * uncompressed (store-only) zip, so nothing is re-encoded and the server never holds the gallery.
 */
export function DownloadAll({ slug, title, manualZip }: { slug: string; title: string; manualZip: boolean }) {
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState("");

  // A zip the photographer uploaded by hand wins over the automatic one.
  if (manualZip) {
    return <a className="btn btn-primary" href={`/api/g/${slug}/zip`}>Download all</a>;
  }

  async function run() {
    setError("");
    const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
    const fileName = `${safeName(title)}.zip`;
    try {
      // The save dialog must open straight from the click, before any awaiting.
      const handle = picker
        ? await picker({ suggestedName: fileName, types: [{ description: "Zip archive", accept: { "application/zip": [".zip"] } }] })
        : null;
      setPct(0);

      const res = await fetch(`/api/g/${slug}/files`);
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not start the download.");
      const list = (await res.json()) as FileList;

      if (!handle && list.totalBytes > MEMORY_LIMIT) {
        throw new Error(
          `This gallery is ${formatBytes(list.totalBytes)}, too big for this browser to zip. Use Chrome or Edge on a computer, or download photos one at a time.`,
        );
      }

      const { downloadZip } = await import("client-zip");
      async function* entries() {
        for (const f of list.files) {
          const r = await fetch(f.url);
          if (!r.ok) throw new Error(`Could not fetch ${f.name} (${r.status}).`);
          yield { name: f.name, lastModified: new Date(), input: r };
        }
      }

      let written = 0;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          written += chunk.byteLength;
          setPct(Math.min(99, Math.round((written / list.totalBytes) * 100)));
          controller.enqueue(chunk);
        },
      });
      const zipStream = downloadZip(entries()).body!.pipeThrough(counter);

      if (handle) {
        await zipStream.pipeTo(await handle.createWritable());
      } else {
        const blob = await new Response(zipStream).blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setPct(100);
      setTimeout(() => setPct(null), 2500);
    } catch (e) {
      setPct(null);
      if (e instanceof DOMException && e.name === "AbortError") return; // closed the save dialog
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn btn-primary min-w-36" onClick={run} disabled={pct !== null}>
        {pct === null ? "Download all" : pct >= 100 ? "Done" : `Zipping ${pct}%`}
      </button>
      {pct !== null && pct < 100 && <span className="text-xs text-muted">Keep this tab open</span>}
      {error && <span role="alert" className="max-w-xs text-right text-xs text-red-700">{error}</span>}
    </div>
  );
}
