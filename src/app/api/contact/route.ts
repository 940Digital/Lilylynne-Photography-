import { verifySolution } from "altcha-lib/v1";

interface ContactBody {
  name?: string;
  email?: string;
  phone?: string;
  session?: string;
  dates?: string;
  message?: string;
  company?: string;
  altcha?: string;
}

const json = (body: unknown, status: number) => Response.json(body, { status });

export async function POST(req: Request) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return json({ error: "Missing required fields" }, 400);
  }
  const { name, email, phone, session, dates, message, company, altcha } = body;

  // Honeypot: a real visitor never sees or fills this field.
  if (company) return json({ success: true }, 200);

  // ALTCHA proof-of-work captcha, same as 940digital.com's contact form.
  let verified = false;
  try {
    verified = altcha ? await verifySolution(altcha, process.env.ALTCHA_HMAC_KEY as string, true) : false;
  } catch {
    verified = false;
  }
  if (!verified) return json({ error: "Captcha verification failed" }, 400);

  if (!name || !email || !message) return json({ error: "Missing required fields" }, 400);

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: '"Lilylynne Photography Website" <forms@940digital.com>',
        to: ["piperlvaughan@gmail.com"],
        reply_to: email,
        subject: `New session enquiry from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "not given"}\nSession type: ${session || "not given"}\nPreferred dates or times: ${dates || "flexible"}\n\nMessage:\n${message}`,
      }),
    });
    if (!resendRes.ok) {
      console.error("Resend error:", await resendRes.text());
      return json({ error: "Failed to send email" }, 502);
    }
    return json({ success: true }, 200);
  } catch (err) {
    console.error("Contact form error:", err);
    return json({ error: "Server error" }, 500);
  }
}
