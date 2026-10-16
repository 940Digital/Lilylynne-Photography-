import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studio } from "@studio";
import { Brand } from "@/components/Brand";
import { hasGalleryAccess } from "@/lib/auth";
import { coverPhotoFor, getGalleryBySlug, isExpired, listReadyPhotos } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { consumeUsage } from "@/lib/usage";
import { Gate } from "./Gate";
import { Viewer, type ViewerPhoto } from "./Viewer";

export const dynamic = "force-dynamic";
const slugOk = (slug: string) => /^[A-Za-z0-9_-]{8,64}$/.test(slug);

// What shows when the link is sent: the gallery's title, the client's name and the cover photo.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const robots = { index: false, follow: false, nocache: true, noarchive: true };
  const { slug } = await params;
  const g = slugOk(slug) ? await getGalleryBySlug(slug) : null;
  if (!g || isExpired(g)) return { title: "Your gallery", robots };
  const cover = await coverPhotoFor(g);
  const description = `${g.client_name}'s photos by ${studio.name}`;
  const url = `/g/${g.slug}`;
  const images = cover ? [{ url: `${url}/cover?v=${cover.id}`, width: 1200, height: 630, alt: g.title }] : undefined;
  return {
    title: g.title,
    description,
    robots,
    openGraph: { type: "website", siteName: studio.name, title: g.title, description, url, images },
    twitter: { card: images ? "summary_large_image" : "summary", title: g.title, description, images: images?.map((i) => i.url) },
  };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slugOk(slug)) notFound();

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
    return <Gate slug={g.slug} title={g.title} />;
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
  const coverId = (rows.find((p) => p.id === g.cover_photo_id) ?? rows[0])?.id;
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

  return <Viewer slug={g.slug} title={g.title} coverId={coverId} clientName={g.client_name} photos={photos} expiresAt={g.expires_at} />;
}
