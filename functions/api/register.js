// POST /api/register — partner-branded lead registration
// Sends welcome email from the partner's domain via their Resend key
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { name, company, email, phone, space_type, sites, country, needs, partner } = body;

  if (!name || !email || !company) {
    return Response.json({ error: 'Name, company, and email are required' }, { status: 400 });
  }

  // Partner-specific config
  const partners = {
    'proximity-green': {
      resendKey: env.RESEND_API_KEY_PG,
      from: 'Proximity Green <hello@proximity.green>',
      brandName: 'Proximity Green',
      brandColor: '#059669',
      portalUrl: 'https://proximity.green',
      notifyTo: ['craig@proximity.green', 'craig@2nth.ai'],
    },
  };

  const config = partners[partner];
  if (!config || !config.resendKey) {
    // Fall back to 2nth.ai for unknown partners
    return forwardTo2nth(env, body);
  }

  // 1. Send welcome email to the registrant from partner domain
  const welcomeHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0">
      <div style="background:${config.brandColor};padding:24px 28px;border-radius:12px 12px 0 0">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.02em">${config.brandName}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px">AI Skills Hub</div>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #e7e5e4;border-top:none;border-radius:0 0 12px 12px">
        <div style="font-size:18px;font-weight:700;color:#1c1917;margin-bottom:12px">Welcome, ${escapeHtml(name)}</div>
        <p style="font-size:14px;color:#57534e;line-height:1.6;margin-bottom:16px">
          Thanks for registering with ${config.brandName}. Your AI-powered workspace is ready — you have <strong>50,000 free tokens</strong> to explore our skills.
        </p>
        <div style="background:#f5f5f4;border-radius:8px;padding:16px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin-bottom:8px">Your registration</div>
          <table style="font-size:13px;color:#44403c;width:100%">
            <tr><td style="padding:3px 0;color:#78716c;width:90px">Company</td><td style="padding:3px 0;font-weight:600">${escapeHtml(company)}</td></tr>
            <tr><td style="padding:3px 0;color:#78716c">Space type</td><td style="padding:3px 0">${escapeHtml(space_type || 'Not specified')}</td></tr>
            <tr><td style="padding:3px 0;color:#78716c">Sites</td><td style="padding:3px 0">${escapeHtml(sites || 'Not specified')}</td></tr>
            <tr><td style="padding:3px 0;color:#78716c">Country</td><td style="padding:3px 0">${escapeHtml(country || 'Not specified')}</td></tr>
          </table>
        </div>
        <a href="https://2nth.ai/join.html" style="display:inline-block;background:${config.brandColor};color:#fff;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.5px">Explore skills &rarr;</a>
        <p style="font-size:12px;color:#a8a29e;margin-top:20px;line-height:1.5">
          A member of our team will reach out within 24 hours to schedule a discovery call and help configure your workspace.
        </p>
      </div>
    </div>
  `;

  const welcomeRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject: `Welcome to ${config.brandName} — your AI workspace is ready`,
      html: welcomeHtml,
    }),
  });

  // 2. Notify partner team about the new registration
  const notifyHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${config.brandColor};margin-bottom:16px;font-weight:700">${config.brandName} — NEW REGISTRATION</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#78716c;width:100px">Name</td><td style="padding:8px 0;color:#1c1917;font-weight:600">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Company</td><td style="padding:8px 0;color:#1c1917;font-weight:600">${escapeHtml(company)}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(email)}" style="color:${config.brandColor}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Phone</td><td style="padding:8px 0;color:#1c1917">${escapeHtml(phone || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Space type</td><td style="padding:8px 0;color:#1c1917">${escapeHtml(space_type || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Sites</td><td style="padding:8px 0;color:#1c1917">${escapeHtml(sites || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Country</td><td style="padding:8px 0;color:#1c1917">${escapeHtml(country || '—')}</td></tr>
      </table>
      ${needs ? `<div style="margin-top:16px;padding:16px;background:#f5f5f4;border-radius:8px;font-size:14px;color:#44403c;line-height:1.6"><strong>What they need:</strong><br>${escapeHtml(needs)}</div>` : ''}
      <div style="margin-top:20px;font-size:12px;color:#a8a29e">Lead stage: <strong>Registered</strong> &rarr; Schedule discovery call</div>
    </div>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: config.notifyTo,
      reply_to: email,
      subject: `[Lead] ${company} — ${space_type || 'new registration'}`,
      html: notifyHtml,
    }),
  });

  return Response.json({ success: true });
}

// Fallback for non-partner-configured registrations
async function forwardTo2nth(env, body) {
  if (!env.RESEND_API_KEY) {
    return Response.json({ success: true }); // Silently succeed if no key
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: '2nth.ai <hello@2nth.ai>',
      to: ['craig@2nth.ai'],
      reply_to: body.email,
      subject: `[Registration] ${body.company} — ${body.partner || 'direct'}`,
      html: `<pre>${JSON.stringify(body, null, 2)}</pre>`,
    }),
  });

  return Response.json({ success: true });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
