import { studio } from "@studio";
import { Brand } from "@/components/Brand";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
      <div>
        <Brand />
        <h1 className="display mt-8 text-3xl">Page not found</h1>
        <p className="mt-3 text-muted">
          Check the link you were sent, or email{" "}
          <a className="underline" href={`mailto:${studio.adminContactEmail}`}>{studio.adminContactEmail}</a>.
        </p>
      </div>
    </main>
  );
}
