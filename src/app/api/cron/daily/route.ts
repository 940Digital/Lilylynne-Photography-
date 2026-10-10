import { env } from "@/lib/env";
import { runDailyMaintenance } from "@/lib/expiry";

// Triggered by the cron entry in vercel.json. Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const lines: string[] = [];
  await runDailyMaintenance((m) => (console.log(m), lines.push(m)));
  return Response.json({ ok: true, log: lines }, { headers: { "Cache-Control": "no-store" } });
}
