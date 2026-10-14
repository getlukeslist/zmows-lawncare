// Quote form handler: sends the request to Joe through Resend.
// Requires RESEND_API_KEY (and optionally RESEND_FROM_EMAIL) in the Vercel project env.

const MAX_LEN = { Name: 200, Phone: 50, Email: 200, 'Service Needed': 100, Message: 5000 };

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Basic shape check: one @, no spaces or line breaks, and a dot in the domain.
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// At least 7 digits, ignoring spaces, dashes, parentheses, etc.
function isValidPhone(value) {
  return value.replace(/\D/g, '').length >= 7;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = null; }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Honeypot: bots fill the hidden field, so pretend it worked and send nothing.
    if (body._honey) {
      return res.status(200).json({ success: true });
    }

    const name = clean(body.Name, MAX_LEN.Name);
    const phone = clean(body.Phone, MAX_LEN.Phone);
    const email = clean(body.Email, MAX_LEN.Email);
    const service = clean(body['Service Needed'], MAX_LEN['Service Needed']);
    const message = clean(body.Message, MAX_LEN.Message);

    if (!name || !(isValidPhone(phone) || isValidEmail(email))) {
      return res.status(400).json({ error: 'Name and a phone number or valid email are required' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('Z Mows Lawn Care contact form — RESEND_API_KEY is not set');
      return res.status(500).json({ error: 'Failed to send message' });
    }

    const show = (v) => v || 'Not provided';
    const html = `
      <h2>New Quote Request from Z Mows Lawn Care Website</h2>
      <p><strong>Name:</strong> ${escapeHtml(show(name))}</p>
      <p><strong>Phone:</strong> ${escapeHtml(show(phone))}</p>
      <p><strong>Email:</strong> ${escapeHtml(show(email))}</p>
      <p><strong>Service Needed:</strong> ${escapeHtml(show(service))}</p>
      <p><strong>Message:</strong><br>${escapeHtml(show(message)).replace(/\n/g, '<br>')}</p>
    `;
    const text = `New Quote Request from Z Mows Lawn Care Website

Name: ${show(name)}
Phone: ${show(phone)}
Email: ${show(email)}
Service Needed: ${show(service)}
Message: ${show(message)}`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Z Mows Lawn Care Website <leads@getlukeslist.com>',
        to: 'zmowslawncare@gmail.com',
        bcc: 'luke@getlukeslist.com',
        subject: 'New quote request - Z Mows Lawn Care',
        html,
        text,
        ...(isValidEmail(email) && { reply_to: email }),
      }),
    });

    const data = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error('Z Mows Lawn Care contact form — Resend error:', resendRes.status, data);
      return res.status(500).json({ error: data.message || 'Failed to send message' });
    }

    console.log('Z Mows Lawn Care contact form — sent, Resend id:', data.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Z Mows Lawn Care contact form — unexpected error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};
