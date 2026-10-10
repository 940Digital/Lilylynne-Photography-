import { studio } from "@studio";
import { AdminHeader } from "@/components/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { toDateInput } from "@/lib/format";
import { NewGalleryForm } from "./NewGalleryForm";

export const metadata = { title: "New gallery" };
export const dynamic = "force-dynamic";

export default async function NewGalleryPage() {
  await requireAdmin();
  const defaultExpiry = toDateInput(Math.floor(Date.now() / 1000) + studio.defaultExpiryDays * 86400);
  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="display mb-6 text-3xl">New gallery</h1>
        <NewGalleryForm defaultExpiry={defaultExpiry} />
      </main>
    </>
  );
}
