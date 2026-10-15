import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studio } from "@studio";
import { Brand } from "@/components/Brand";
import { hasGalleryAccess } from "@/lib/auth";
import { getGalleryBySlug, isExpired, listReadyPhotos } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { consumeUsage } from "@/lib/usage";
import { Gate } from "./Gate";
import { Viewer, type ViewerPhoto } from "./Viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your gallery",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) notFound();

  const g = await getGalleryBySlug(slug);
  if (!g) notFound();

  if (isExpired(g)) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
        <div>
          <Brand />
          <h1 className="display mt-8 text-3xl">This gallery has expired</h1>
          <p className="mt-3 text-muted">
            Galleries are only kept online for a limited time. Please contact {studio.name} at{" "}
            <a className="underline" href={`mailto:${studio.adminContactEmail}`}>{studio.adminContactEmail}</a>{" "}
            and we will be happy to help.
          </p>
        </div>
      </main>
    );
  }

  if (!(await hasGalleryAccess(g))) {
    return <Gate slug={g.slug} />;
  }

  const rows = await listReadyPhotos(g.id);
  // Thumbnail + preview URL per photo. Over the monthly budget we stop serving instead of risking a bill.
  if (!(await consumeUsage("read", rows.length * 2))) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
        <div>
          <Brand />
          <h1 className="display mt-8 text-3xl">Gallery temporarily unavailable</h1>
          <p className="mt-3 text-muted">
            This gallery is very busy right now. Please try again later, or contact {studio.name} at{" "}
            <a className="underline" href={`mailto:${studio.adminContactEmail}`}>{studio.adminContactEmail}</a>.
          </p>
        </div>
      </main>
    );
  }
  const photos: ViewerPhoto[] = await Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      filename: p.filename,
      width: p.width,
      height: p.height,
      thumb: await presignGet(p.thumb_key),
      preview: await presignGet(p.preview_key),
    })),
  );

  return <Viewer slug={g.slug} title={g.title} clientName={g.client_name} photos={photos} expiresAt={g.expires_at} />;
}
