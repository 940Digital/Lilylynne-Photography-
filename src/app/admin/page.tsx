import Link from "next/link";
import { studio } from "@studio";
import { AdminHeader } from "@/components/AdminHeader";
import { CopyButton } from "@/components/CopyButton";
import { requireAdmin } from "@/lib/auth";
import { isExpired, nowSec, query, type Gallery } from "@/lib/db";
import { env } from "@/lib/env";
import { formatBytes, formatDate } from "@/lib/format";
import { currentUsage } from "@/lib/usage";

export const metadata = { title: "Galleries" };
export const dynamic = "force-dynamic";

type Row = Gallery & { photo_count: number };

export default async function AdminDashboard() {
  await requireAdmin();
  const results = await query<Row>(
    `SELECT g.*, (SELECT COUNT(*) FROM photos p WHERE p.gallery_id = g.id AND p.status = 'ready') AS photo_count
     FROM galleries g ORDER BY g.created_at DESC`,
  );

  const activeCount = results.filter((g) => !isExpired(g)).length;
  const usedBytes = results.reduce((sum, g) => sum + g.total_bytes, 0);
  const pct = Math.min(100, Math.round((activeCount / studio.maxActiveGalleries) * 100));
  const usage = await currentUsage();
  const meters = [
    { label: "Storage", text: `${formatBytes(usedBytes)} of ${formatBytes(studio.maxTotalBytes)}`, value: usedBytes / studio.maxTotalBytes },
    { label: "Views this month", text: `${usage.read.toLocaleString()} of ${studio.monthlyReadBudget.toLocaleString()}`, value: usage.read / studio.monthlyReadBudget },
    { label: "Uploads this month", text: `${usage.write.toLocaleString()} of ${studio.monthlyWriteBudget.toLocaleString()}`, value: usage.write / studio.monthlyWriteBudget },
  ];
  const base = env.appUrl;

  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="card p-5">
          <p className="text-lg">
            <strong>{activeCount}</strong> of {studio.maxActiveGalleries} galleries
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Active galleries used">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {meters.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs text-muted"><span>{m.label}</span><span>{m.text}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className={`h-full rounded-full ${m.value > 0.8 ? "bg-red-700" : "bg-accent"}`} style={{ width: `${Math.min(100, Math.round(m.value * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">These limits keep the site inside Cloudflare's free tier. At the limit, uploads or viewing pause until space or the new month frees up.</p>
        </section>

        <h1 className="display mb-4 mt-10 text-3xl">Galleries</h1>
        {results.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            No galleries yet. <Link className="underline" href="/admin/new">Create the first one.</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {results.map((g) => {
              const expired = isExpired(g);
              const daysLeft = Math.ceil((g.expires_at - nowSec()) / 86400);
              return (
                <li key={g.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link href={`/admin/galleries/${g.id}`} className="display text-xl underline-offset-4 hover:underline">
                      {g.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {g.client_name} · {g.photo_count} photos · {formatBytes(g.total_bytes)}
                      {g.password_hash ? " · password" : ""}
                    </p>
                    <p className={`text-sm ${expired ? "text-red-700" : "text-muted"}`}>
                      {expired ? `Expired ${formatDate(g.expires_at)}` : `Expires ${formatDate(g.expires_at)} (${daysLeft} days)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="hidden max-w-[16rem] truncate rounded bg-paper px-2 py-1 text-xs text-muted md:block">
                      {base ? `${base}/g/${g.slug}` : `/g/${g.slug}`}
                    </code>
                    <CopyButton path={`/g/${g.slug}`} />
                    <Link href={`/admin/galleries/${g.id}`} className="btn">Manage</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
