// GET /api/access-approve?token=...&return=... — approve an access request
// Called from the email link by an admin. Sets the cookie for the requester.
// Note: this is a simplified flow — the admin clicks the link, which creates
// a magic link they can forward to the requester, or the requester re-submits
// their email and gets auto-approved next time.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const returnTo = url.searchParams.get('return') || '/partners/';

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  try {
    const session = JSON.parse(atob(decodeURIComponent(token)));

    if (!session.email || !session.approved) {
      return new Response('Invalid token', { status: 400 });
    }

    // Store approval in KV if available (so re-login works)
    if (env.ACCESS_KV) {
      await env.ACCESS_KV.put(`approved:${session.email}`, JSON.stringify({
        name: session.name,
        approved: true,
        approvedAt: new Date().toISOString(),
      }), { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
    }

    const maxAge = 60 * 60 * 24 * 30; // 30 days cookie

    // Send confirmation email to the approved user
    const resendKey = env.RESEND_API_KEY;
    if (resendKey) {
      const origin = url.origin;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: '2nth.ai <hello@2nth.ai>',
          to: [session.email],
          subject: 'Access approved — 2nth.ai Partner Portal',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#059669;margin-bottom:16px;font-weight:700">ACCESS APPROVED</div>
              <p style="font-size:15px;color:#1c1917;font-weight:600;margin-bottom:8px">Hi ${esc(session.name)},</p>
              <p style="font-size:14px;color:#57534e;line-height:1.6">Your access to the 2nth.ai partner portal has been approved. Click the link below to sign in:</p>
              <a href="${origin}/api/access-login?token=${encodeURIComponent(token)}&return=${encodeURIComponent(returnTo)}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;margin:16px 0">Enter Partner Portal &rarr;</a>
              <p style="font-size:12px;color:#a8a29e;margin-top:16px">This link is valid for 30 days.</p>
            </div>
          `,
        }),
      });
    }

    // Show confirmation to the admin
    return new Response(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>Access Approved</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;margin:0}
      .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:40px;max-width:400px;text-align:center}
      h1{font-size:22px;color:#059669;margin:0 0 12px}p{font-size:14px;color:#71717a;line-height:1.6}</style>
      </head><body><div class="card">
        <h1>Access Approved</h1>
        <p><strong>${esc(session.name)}</strong> (${esc(session.email)}) has been granted access to the partner portal.</p>
        <p>A sign-in link has been emailed to them.</p>
      </div></body></html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (e) {
    return new Response('Invalid token: ' + e.message, { status: 400 });
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
