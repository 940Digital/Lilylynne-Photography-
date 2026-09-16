// Self-hosted CAPTCHA challenge endpoint (ALTCHA, proof-of-work based).
// Same pattern as 940digital.com's contact form: no math question, no
// external account, no per-hostname cap.
import { createChallenge } from "altcha-lib/v1";

const HMAC_KEY = process.env.ALTCHA_HMAC_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  try {
    const challenge = await createChallenge({
      hmacKey: HMAC_KEY,
      maxNumber: 100000,
      expires: new Date(Date.now() + 5 * 60 * 1000),
    });
    res.status(200).json(challenge);
  } catch (err) {
    res.status(500).json({ error: "challenge generation failed" });
  }
}
