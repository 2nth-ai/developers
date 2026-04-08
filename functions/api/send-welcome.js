// POST /api/send-welcome — send a partner welcome email
// Only callable with the admin secret or from trusted sources
export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { to, cc, name, company, tokens, tier, code, signInUrl, portalUrl } = body;
  if (!to || !name) return Response.json({ error: 'to and name required' }, { status: 400 });

  const html = `
    <div style="font-family:'DM Sans',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:0">
      <div style="background:#1e1e24;padding:28px 32px;border-radius:12px 12px 0 0">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#c5c5ce;margin-bottom:4px">2NTH.AI PARTNER PORTAL</div>
        <div style="font-size:24px;font-weight:700;color:#fff">Welcome, ${esc(name)}</div>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e0e0e4;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:15px;color:#1e1e24;margin:0 0 16px">You've been registered as a <strong>${esc(tier || 'Builder')}</strong> partner on the 2nth.ai platform.</p>

        <div style="background:#f0f0f4;border-radius:8px;padding:16px;margin-bottom:20px">
          <table style="font-size:13px;color:#4a4a56;width:100%">
            <tr><td style="padding:4px 0;color:#8e8e9a;width:120px">Company</td><td style="padding:4px 0;font-weight:600;color:#1e1e24">${esc(company || '—')}</td></tr>
            <tr><td style="padding:4px 0;color:#8e8e9a">Partner tier</td><td style="padding:4px 0;font-weight:600;color:#1e1e24">${esc(tier || 'Builder')}</td></tr>
            <tr><td style="padding:4px 0;color:#8e8e9a">Token balance</td><td style="padding:4px 0;font-weight:600;color:#1e1e24">${esc(tokens || '500,000')} tokens</td></tr>
            <tr><td style="padding:4px 0;color:#8e8e9a">Access code</td><td style="padding:4px 0;font-weight:600;color:#1e1e24;font-family:monospace">${esc(code || '—')}</td></tr>
          </table>
        </div>

        <p style="font-size:14px;color:#4a4a56;margin:0 0 20px">Click the button below to sign in to the partner portal and explore your assets:</p>

        <a href="${esc(signInUrl || portalUrl || 'https://developers.2nth.ai/hub.html')}" style="display:inline-block;background:#e4373c;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px">Sign in to Partner Portal &rarr;</a>

        <p style="font-size:12px;color:#8e8e9a;margin:20px 0 0;line-height:1.6">
          You can also sign in manually at <a href="https://developers.2nth.ai/access.html" style="color:#e4373c">developers.2nth.ai</a> — select your name and enter your access code.
        </p>
      </div>
      <div style="text-align:center;padding:16px;font-size:11px;color:#8e8e9a">
        2nth.ai — from thought to motion
      </div>
    </div>
  `;

  const recipients = [to];
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : [];

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '2nth.ai <hello@2nth.ai>',
        to: recipients,
        cc: ccList,
        subject: `Welcome to 2nth.ai — ${tier || 'Builder'} Partner Access`,
        html: html,
      }),
    });
    return Response.json({ success: true, message: 'Welcome email sent to ' + to });
  } catch (e) {
    return Response.json({ error: 'Failed to send: ' + e.message }, { status: 500 });
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
