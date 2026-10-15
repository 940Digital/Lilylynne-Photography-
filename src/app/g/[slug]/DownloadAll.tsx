"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";

interface Entry {
  id: string;
  name: string;
  bytes: number;
  url: string; // signed storage URL, read directly when the bucket allows it
  proxy: string; // same-origin fallback that streams the file through the app
}
interface Listing {
  files: Entry[];
  totalBytes: number;
}
interface Part {
  files: Entry[];
  bytes: number;
}

type SaveHandle = { createWritable(): Promise<WritableStream<Uint8Array>> };
type SavePicker = (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle>;

// Browsers that cannot stream to disk build each zip in memory, so keep every part small.
const PART_BYTES = 700 * 1024 ** 2;
const ATTEMPTS = 4;

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "gallery";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

class Fatal extends Error {}

function splitParts(files: Entry[], cap: number): Part[] {
  const parts: Part[] = [];
  let cur: Part = { files: [], bytes: 0 };
  for (const f of files) {
    if (cur.files.length && cur.bytes + f.bytes > cap) {
      parts.push(cur);
      cur = { files: [], bytes: 0 };
    }
    cur.files.push(f);
    cur.bytes += f.bytes;
  }
  if (cur.files.length) parts.push(cur);
  return parts;
}

/**
 * Builds the zip in the visitor's browser. Originals are fetched one at a time (with retries)
 * and stored uncompressed, so nothing is re-encoded and the server never holds the gallery.
 *
 * Chrome and Edge on a computer stream one zip straight to disk. Every other browser gets the
 * gallery in parts that each fit comfortably in memory.
 */
export function DownloadAll({ slug, title, manualZip }: { slug: string; title: string; manualZip: boolean }) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [parts, setParts] = useState<Part[] | null>(null);
  const [donePart, setDonePart] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const listing = useRef<Listing | null>(null);
  const useProxy = useRef(false);
  // The browser rewrites errors from a zip stream into a bare "Failed to fetch", so keep the real one.
  const firstError = useRef<Error | null>(null);

  // Warn before closing the tab mid-download.
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  // A zip the photographer uploaded by hand wins over the automatic one.
  if (manualZip) {
    return <a className="btn btn-primary" href={`/api/g/${slug}/zip`}>Download all</a>;
  }

  async function loadListing(): Promise<Listing> {
    const res = await fetch(`/api/g/${slug}/files`);
    if (!res.ok) {
      const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
      if (res.status === 401) throw new Fatal("Please reload the page and enter the gallery password again.");
      throw new Fatal(msg ?? "Could not start the download.");
    }
    const l = (await res.json()) as Listing;
    listing.current = l;
    return l;
  }

  /** One original as bytes. Retries, refreshes expired links, and falls back to the proxy. */
  async function getBytes(f: Entry, signal: AbortSignal, onBytes: (n: number) => void): Promise<Uint8Array> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      try {
        const current = listing.current?.files.find((x) => x.id === f.id) ?? f;
        const res = await fetch(useProxy.current ? current.proxy : current.url, { signal });
        if (res.status === 401) throw new Fatal("Please reload the page and enter the gallery password again.");
        if (res.status === 403 && !useProxy.current) {
          await loadListing(); // signed link expired: get fresh ones and try again
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const expected = Number(res.headers.get("content-length"));
        if (!buf.length || (expected && expected !== buf.length)) throw new Error("Incomplete download");
        onBytes(f.bytes); // declared size includes the viewing copies, so progress counts whole files
        return buf;
      } catch (e) {
        if (isAbort(e) || e instanceof Fatal) throw e;
        lastErr = e;
        // A blocked cross-origin read (no storage CORS) surfaces as a TypeError: go through the app instead.
        if (!useProxy.current && e instanceof TypeError) {
          useProxy.current = true;
          continue;
        }
        await sleep(600 * 2 ** attempt);
      }
    }
    throw new Error(`Could not download ${f.name}${lastErr instanceof Error ? ` (${lastErr.message})` : ""}.`);
  }

  /** Streams a set of files into a zip, fetching the next file while the current one is written. */
  async function buildZip(files: Entry[], signal: AbortSignal) {
    const { downloadZip } = await import("client-zip");
    const total = files.reduce((s, f) => s + f.bytes, 0) || 1;
    let got = 0;
    const onBytes = (n: number) => {
      got += n;
      setPct(Math.min(99, Math.round((got / total) * 100)));
    };
    async function* entries() {
      const start = (i: number) => {
        const p = getBytes(files[i], signal, onBytes);
        p.catch(() => {}); // surfaced when awaited below
        return p;
      };
      let pending = start(0);
      for (let i = 0; i < files.length; i++) {
        const next = i + 1 < files.length ? start(i + 1) : null;
        let input: Uint8Array;
        try {
          input = await pending;
        } catch (e) {
          if (!isAbort(e) && e instanceof Error) firstError.current ??= e;
          throw e;
        }
        yield { name: files[i].name, lastModified: new Date(), input };
        pending = next as Promise<Uint8Array>;
      }
    }
    return downloadZip(entries());
  }

  async function guarded(work: (signal: AbortSignal) => Promise<void>) {
    setError("");
    firstError.current = null;
    setBusy(true);
    setPct(0);
    const ctl = new AbortController();
    abort.current = ctl;
    let lock: { release(): Promise<void> } | null = null;
    try {
      lock = (await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch {
      /* optional */
    }
    try {
      await work(ctl.signal);
    } catch (e) {
      // Browsers report a cancelled zip stream as a network error, so trust the signal over the error type.
      if (!ctl.signal.aborted && !isAbort(e)) setError((firstError.current as Error | null)?.message ?? (e instanceof Error ? e.message : "Download failed."));
    } finally {
      lock?.release().catch(() => {});
      abort.current = null;
      setBusy(false);
    }
  }

  function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }

  async function start() {
    const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
    const fileName = `${safeName(title)}.zip`;
    setParts(null);
    setDonePart(new Set());
    setFinished(false);

    // The save dialog has to open straight from the click, before any awaiting.
    let handle: SaveHandle | null = null;
    if (picker) {
      try {
        handle = await picker({ suggestedName: fileName, types: [{ description: "Zip archive", accept: { "application/zip": [".zip"] } }] });
      } catch (e) {
        if (isAbort(e)) return; // closed the save dialog
        handle = null; // blocked here (embedded page, etc.): use the in-memory route
      }
    }

    await guarded(async (signal) => {
      setLabel("Preparing");
      const l = await loadListing();
      if (handle) {
        setLabel("Zipping");
        const zip = await buildZip(l.files, signal);
        await zip.body!.pipeTo(await handle.createWritable(), { signal });
        setPct(100);
        setFinished(true);
        return;
      }
      const split = splitParts(l.files, (window as unknown as { __zipPartBytes?: number }).__zipPartBytes ?? PART_BYTES);
      if (split.length === 1) {
        setLabel("Zipping");
        saveBlob(await (await buildZip(split[0].files, signal)).blob(), fileName);
        setPct(100);
        setFinished(true);
      } else {
        setParts(split); // the visitor picks each part: one click, one download, no popup blocking
      }
    });
  }

  async function runPart(i: number) {
    if (!parts) return;
    await guarded(async (signal) => {
      setLabel(`Part ${i + 1}`);
      const blob = await (await buildZip(parts[i].files, signal)).blob();
      saveBlob(blob, `${safeName(title)}-part-${i + 1}-of-${parts.length}.zip`);
      setDonePart((s) => new Set(s).add(i));
    });
  }

  return (
    <div className="flex max-w-xs flex-col items-end gap-1.5">
      {parts ? (
        <div className="w-72 rounded-xl border border-line bg-white p-3 text-left text-sm">
          <p className="text-muted">
            This gallery is large ({formatBytes(parts.reduce((n, p) => n + p.bytes, 0))}), so your browser saves it in {parts.length} parts. Download each one.
          </p>
          <ul className="mt-2 space-y-1.5">
            {parts.map((p, i) => (
              <li key={i}>
                <button className="btn w-full justify-between" disabled={busy} onClick={() => runPart(i)}>
                  <span>Part {i + 1} ({p.files.length} photos)</span>
                  <span>{donePart.has(i) ? "Saved" : busy && label === `Part ${i + 1}` ? `${pct}%` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button className="btn btn-primary min-w-36" onClick={start} disabled={busy}>
          {busy ? `${label} ${pct}%` : finished ? "Downloaded. Again?" : "Download all"}
        </button>
      )}
      {busy && (
        <span className="flex items-center gap-2 text-xs text-muted">
          Keep this tab open
          <button className="underline" onClick={() => abort.current?.abort()}>Cancel</button>
        </span>
      )}
      {error && (
        <span role="alert" className="text-right text-xs text-red-700">
          {error} <button className="underline" onClick={start}>Try again</button>
        </span>
      )}
    </div>
  );
}
