export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { name, email, phone, session, dates, message, company } = req.body || {};

  // Honeypot: a real visitor never sees or fills this field.
  if (company) {
    res.status(200).json({ success: true });
    return;
  }

  if (!name || !email || !message) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '"Lilylynne Photography Website" <forms@940digital.com>',
        to: ['piperlvaughan@gmail.com'],
        reply_to: email,
        subject: `New session enquiry from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'not given'}\nSession type: ${session || 'not given'}\nPreferred dates or times: ${dates || 'flexible'}\n\nMessage:\n${message}`,
      }),
    });

    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text());
      res.status(502).json({ error: 'Failed to send email' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
