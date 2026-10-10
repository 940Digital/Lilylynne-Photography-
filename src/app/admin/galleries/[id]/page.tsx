import Link from "next/link";
import { notFound } from "next/navigation";
import { studio } from "@studio";
import { AdminHeader } from "@/components/AdminHeader";
import { AdminPhotos } from "@/components/AdminPhotos";
import { CopyButton } from "@/components/CopyButton";
import { DeleteGalleryButton, SettingsForm, ZipManager } from "@/components/GalleryTools";
import { Uploader } from "@/components/Uploader";
import { requireAdmin } from "@/lib/auth";
import { getGalleryById, isExpired, listReadyPhotos } from "@/lib/db";
import { env } from "@/lib/env";
import { formatBytes, formatDate, toDateInput } from "@/lib/format";
import { idParam } from "@/lib/http";
import { presignGet } from "@/lib/storage";
import { recordUsage } from "@/lib/usage";

export const metadata = { title: "Manage gallery" };
export const dynamic = "force-dynamic";

export default async function ManageGallery({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const g = await getGalleryById(id.data);
  if (!g) notFound();

  const photos = await listReadyPhotos(g.id);
  const maxOrder = photos.reduce((m, p) => Math.max(m, p.sort_order), -1);
  await recordUsage("read", photos.length);
  const adminPhotos = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      filename: p.filename,
      thumbUrl: await presignGet(p.thumb_key, { expiresSec: 3600 }),
      bytes: p.size_bytes,
      width: p.width,
      height: p.height,
    })),
  );

  const expired = isExpired(g);
  const usedPct = Math.min(100, Math.round((g.total_bytes / studio.maxBytesPerGallery) * 100));
  const shareBase = env.appUrl;

  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div>
          <Link href="/admin" className="text-sm text-muted underline">All galleries</Link>
          <h1 className="display mt-2 text-4xl">{g.title}</h1>
          <p className="text-muted">
            {g.client_name} · {expired ? `Expired ${formatDate(g.expires_at)}` : `Expires ${formatDate(g.expires_at)}`}
          </p>
        </div>

        <section className="card space-y-3 p-5">
          <h2 className="display text-2xl">Client link</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-paper px-3 py-2 text-sm">{shareBase}/g/{g.slug}</code>
            <CopyButton path={`/g/${g.slug}`} />
            <Link className="btn" href={`/g/${g.slug}`} target="_blank">Open</Link>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{formatBytes(g.total_bytes)} of {formatBytes(studio.maxBytesPerGallery)}</span>
              <span>{photos.length} photos</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${usedPct}%` }} /></div>
          </div>
        </section>

        {expired ? (
          <p className="card border-red-200 p-4 text-sm text-red-800">
            This gallery has expired and the client can no longer open it. Set a new date below to reopen it
            {g.purged_at ? ", but its files were already deleted." : "."}
          </p>
        ) : (
          <section>
            <h2 className="display mb-3 text-2xl">Upload photos</h2>
            <Uploader galleryId={g.id} startOrder={maxOrder + 1} />
          </section>
        )}

        <section>
          <h2 className="display mb-3 text-2xl">Photos</h2>
          <AdminPhotos galleryId={g.id} photos={adminPhotos} />
        </section>

        <section className="card p-5">
          <h2 className="display mb-3 text-2xl">Download all (zip)</h2>
          <ZipManager galleryId={g.id} zipName={g.zip_key?.split("/").pop() ?? null} zipBytes={g.zip_bytes} />
        </section>

        <section className="card p-5">
          <h2 className="display mb-3 text-2xl">Settings</h2>
          <SettingsForm galleryId={g.id} expiresOn={toDateInput(g.expires_at)} hasPassword={!!g.password_hash} />
        </section>

        <section className="flex justify-end border-t border-line pt-6">
          <DeleteGalleryButton galleryId={g.id} title={g.title} photoCount={photos.length} />
        </section>
      </main>
    </>
  );
}
