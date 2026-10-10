// Self-hosted CAPTCHA challenge endpoint (ALTCHA, proof-of-work based).
// Same pattern as 940digital.com's contact form: no math question, no external account.
import { createChallenge } from "altcha-lib/v1";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function GET() {
  try {
    const challenge = await createChallenge({
      hmacKey: process.env.ALTCHA_HMAC_KEY as string,
      maxNumber: 100000,
      expires: new Date(Date.now() + 5 * 60 * 1000),
    });
    return Response.json(challenge, { headers: CORS });
  } catch {
    return Response.json({ error: "challenge generation failed" }, { status: 500, headers: CORS });
  }
}
