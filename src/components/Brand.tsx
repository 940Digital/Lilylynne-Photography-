import Link from "next/link";
import { studio } from "@studio";

export function Brand({ href = "/", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      {studio.logoPath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={studio.logoPath} alt="" className={size === "lg" ? "h-12 w-12" : "h-8 w-8"} />
      )}
      <span className={`display ${size === "lg" ? "text-3xl" : "text-xl"}`}>{studio.name}</span>
    </Link>
  );
}
