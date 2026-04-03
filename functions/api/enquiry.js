// POST /api/enquiry — handle partner/developer enquiry form
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { name, company, email, interest, space_type, message, partner } = body;

  if (!name || !email || !company) {
    return Response.json({ error: 'Name, company, and email are required' }, { status: 400 });
  }

  // Send notification email via Resend
  const emailHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;margin-bottom:16px;font-weight:700">2NTH.AI — NEW ENQUIRY</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#71717a;width:100px">Name</td><td style="padding:8px 0;color:#18181b;font-weight:600">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Company</td><td style="padding:8px 0;color:#18181b;font-weight:600">${escapeHtml(company)}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(email)}" style="color:#7c3aed">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Interest</td><td style="padding:8px 0;color:#18181b">${escapeHtml(interest || 'Not specified')}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Space type</td><td style="padding:8px 0;color:#18181b">${escapeHtml(space_type || 'Not specified')}</td></tr>
        ${partner ? `<tr><td style="padding:8px 0;color:#71717a">Partner</td><td style="padding:8px 0;color:#18181b">${escapeHtml(partner)}</td></tr>` : ''}
      </table>
      ${message ? `<div style="margin-top:16px;padding:16px;background:#f5f3ff;border-radius:8px;font-size:14px;color:#44403c;line-height:1.6">${escapeHtml(message)}</div>` : ''}
      <div style="margin-top:24px;font-size:11px;color:#a1a1aa">Sent from developers.2nth.ai</div>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '2nth.ai <hello@2nth.ai>',
        to: ['craig@2nth.ai'],
        reply_to: email,
        subject: `[2NTH] Enquiry: ${company} — ${interest || 'general'}`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      return Response.json({ error: 'Failed to send enquiry' }, { status: 502 });
    }
  } catch {
    return Response.json({ error: 'Failed to send enquiry' }, { status: 502 });
  }

  return Response.json({ success: true });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
