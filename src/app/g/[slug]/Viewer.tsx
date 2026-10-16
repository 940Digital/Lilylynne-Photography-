"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { studio } from "@studio";
import { Brand } from "@/components/Brand";
import { formatDate } from "@/lib/format";
import { DownloadAll } from "./DownloadAll";

export interface ViewerPhoto {
  id: string;
  filename: string;
  width: number;
  height: number;
  thumb: string;
  preview: string;
}

const SLIDE_MS = 4000;

export function Viewer({
  slug,
  title,
  coverId,
  clientName,
  photos,
  expiresAt,
}: {
  slug: string;
  title: string;
  coverId?: string;
  clientName: string;
  photos: ViewerPhoto[];
  expiresAt: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const lastTile = useRef<HTMLElement | null>(null);

  // Signed URLs last an hour. If one fails (tab left open), re-render the page for fresh ones.
  const lastRefresh = useRef(0);
  const onImgError = useCallback(() => {
    if (Date.now() - lastRefresh.current > 60_000) {
      lastRefresh.current = Date.now();
      router.refresh();
    }
  }, [router]);

  function start(index: number, play = false) {
    lastTile.current = document.activeElement as HTMLElement | null;
    setOpen(index);
    setPlaying(play);
  }
  function close() {
    setOpen(null);
    setPlaying(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    lastTile.current?.focus?.();
  }

  const dl = (id: string) => `/api/g/${slug}/download/${id}`;
  const cover = photos.find((p) => p.id === coverId) ?? photos[0];
  const subline = `${clientName} · ${photos.length} photos · available until ${formatDate(expiresAt)}`;
  const actions = (
    <>
      {photos.length > 0 && <button className="btn" onClick={() => start(0, true)}>Slideshow</button>}
      {photos.length > 0 && <DownloadAll slug={slug} title={title} />}
    </>
  );

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-8">
        <Brand />
      </div>

      {cover ? (
        <section className="relative mx-auto mt-4 max-w-[1600px] px-2 sm:px-8">
          <div className="relative grid min-h-[68svh] place-items-end overflow-hidden rounded-sm bg-line sm:min-h-[74svh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.preview}
              alt=""
              fetchPriority="high"
              onError={onImgError}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: "50% 30%" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="relative w-full px-5 pb-8 text-center text-white sm:px-10 sm:pb-12">
              <h1 className="display mx-auto max-w-4xl text-balance text-4xl leading-tight sm:text-6xl">{title}</h1>
              <p className="mt-3 text-sm tracking-[0.18em] text-white/85 uppercase sm:text-base">{subline}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-ink">{actions}</div>
            </div>
          </div>
        </section>
      ) : (
        <header className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-8 sm:px-8">
          <div>
            <h1 className="display text-4xl sm:text-5xl">{title}</h1>
            <p className="mt-1 text-muted">{subline}</p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </header>
      )}

      {photos.length === 0 ? (
        <p className="px-4 py-24 text-center text-muted sm:px-8">Photos are on their way. Check back soon.</p>
      ) : (
        <main className="mx-auto max-w-[1600px] columns-2 gap-2 px-2 pb-16 sm:gap-3 sm:px-8 md:columns-3 xl:columns-4">
          {photos.map((p, i) => (
            <div key={p.id} className="group relative mb-2 break-inside-avoid sm:mb-3">
              <button
                onClick={() => start(i)}
                className="block w-full overflow-hidden rounded-sm bg-line"
                style={{ aspectRatio: `${p.width} / ${p.height}` }}
                aria-label={`Open photo ${i + 1} of ${photos.length}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" width={p.width} height={p.height} loading="lazy" decoding="async" onError={onImgError} className="h-full w-full object-cover" />
              </button>
              <a
                href={dl(p.id)}
                aria-label={`Download original of photo ${i + 1}`}
                className="absolute bottom-2 right-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium shadow opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                Download
              </a>
            </div>
          ))}
        </main>
      )}

      <footer className="px-4 pb-12 pt-2 text-center text-sm text-muted">
        <a className="underline underline-offset-4 hover:text-ink" href="/">Visit {studio.publicDomain.replace(/^www\./, "")}</a>
      </footer>

      {open !== null && (
        <Lightbox
          photos={photos}
          index={open}
          setIndex={setOpen}
          playing={playing}
          setPlaying={setPlaying}
          onClose={close}
          downloadHref={dl}
          onImgError={onImgError}
        />
      )}
    </div>
  );
}

function Lightbox({
  photos,
  index,
  setIndex,
  playing,
  setPlaying,
  onClose,
  downloadHref,
  onImgError,
}: {
  photos: ViewerPhoto[];
  index: number;
  setIndex: (fn: (i: number | null) => number) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  onClose: () => void;
  downloadHref: (id: string) => string;
  onImgError: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const n = photos.length;
  const photo = photos[index];

  const go = useCallback((delta: number) => setIndex((i) => (((i ?? 0) + delta) % n + n) % n), [n, setIndex]);

  // Keyboard: arrows, escape, space toggles the slideshow.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying(!playing);
      } else if (e.key === "Tab") {
        // Keep focus inside the dialog.
        const f = root.current?.querySelectorAll<HTMLElement>("button, a[href]");
        if (!f?.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, playing, setPlaying]);

  // Slideshow timer restarts on every slide so manual navigation gets a full interval.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [playing, index, go]);

  // Fullscreen with the slideshow, scroll lock, initial focus.
  useEffect(() => {
    if (playing && !document.fullscreenElement) root.current?.requestFullscreen?.().catch(() => {});
  }, [playing]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Preload neighbours so next/prev feels instant.
  useEffect(() => {
    for (const d of [1, -1, 2]) {
      const p = photos[(((index + d) % n) + n) % n];
      if (p) new Image().src = p.preview;
    }
  }, [index, n, photos]);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${n}`}
      className="fixed inset-0 z-50 flex touch-pan-y select-none flex-col bg-black text-white"
      onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3 text-sm">
        <span className="tabular-nums text-white/70">{index + 1} / {n}</span>
        <div className="flex items-center gap-2">
          <button className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={() => setPlaying(!playing)} aria-pressed={playing}>
            {playing ? "Pause" : "Play"}
          </button>
          <a className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" href={downloadHref(photo.id)}>Download</a>
          <button ref={closeBtn} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.preview}
          alt={`Photo ${index + 1} of ${n}`}
          onError={onImgError}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
        {n > 1 && (
          <>
            <button aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-xl hover:bg-white/20 md:block">&lsaquo;</button>
            <button aria-label="Next photo" onClick={() => go(1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-xl hover:bg-white/20 md:block">&rsaquo;</button>
          </>
        )}
      </div>
    </div>
  );
}
