"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { studio } from "@studio";

export function AdminHeader() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/admin" className="display text-xl">{studio.name}</Link>
        <div className="flex items-center gap-2">
          <Link href="/admin/new" className="btn btn-primary">New gallery</Link>
          <button onClick={logout} className="btn">Sign out</button>
        </div>
      </div>
    </header>
  );
}
