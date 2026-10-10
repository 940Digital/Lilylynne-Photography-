import { endAdminSession } from "@/lib/auth";
import { guardAdmin, json } from "@/lib/http";

export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  await endAdminSession();
  return json({ ok: true });
}
