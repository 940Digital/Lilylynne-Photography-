import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        <Brand />
        <h1 className="display mt-6 text-2xl">Sign in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
