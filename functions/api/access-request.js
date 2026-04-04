// POST /api/access-request — email-based sign in + access request
// Known emails get instant access with scoped permissions
// Unknown emails trigger approval flow

// Known users with their scopes and display names
const KNOWN_USERS = {
  'craig@2nth.ai':         { name: 'Craig Leppan',  scope: 'full' },
  'craig@proximity.green': { name: 'Craig Leppan',  scope: 'proximity-green,luthuli' },
  'mark@proximity.green':  { name: 'Mark',          scope: 'proximity-green' },
  'guy@rumf.co.za':        { name: 'Guy Hamlin',    scope: 'luthuli' },
};

// All @2nth.ai and @2nth.io emails are full-access admin
const ADMIN_DOMAINS = ['2nth.ai', '2nth.io'];

// Route-specific reviewers for approval notifications
const ROUTE_REVIEWERS = {
  'proximity-green': ['mark@proximity.green', 'craig@proximity.green', 'craig@2nth.ai'],
  'luthuli': ['craig@2nth.ai'],
};

function getKnownUser(email) {
  // Check exact match
  if (KNOWN_USERS[email]) return KNOWN_USERS[email];
  // Check admin domains
  var domain = email.split('@')[1];
  if (ADMIN_DOMAINS.includes(domain)) return { name: email.split('@')[0], scope: 'full' };
  return null;
}

function getReviewers(returnTo) {
  var reviewers = ['craig@2nth.ai'];
  for (var route in ROUTE_REVIEWERS) {
    if (returnTo.includes(route)) {
      ROUTE_REVIEWERS[route].forEach(function(r) {
        if (!reviewers.includes(r)) reviewers.push(r);
      });
    }
  }
  return reviewers;
}

function makeSession(email, name, scope) {
  return JSON.stringify({
    email: email,
    name: name,
    approved: true,
    scope: scope,
    fullAccess: scope === 'full',
    at: new Date().toISOString(),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const company = (body.company || '').trim();
  const reason = (body.reason || '').trim();
  const returnTo = body.returnTo || '/partners/';
  const mode = body.mode || 'request'; // 'signin' or 'request'

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  const known = getKnownUser(email);

  if (known) {
    const displayName = name || known.name;
    const session = makeSession(email, displayName, known.scope);
    const maxAge = 60 * 60 * 24 * 30; // 30 days

    // If mode is 'sendlink', email a magic link instead of setting cookie directly
    if (mode === 'sendlink') {
      const origin = new URL(request.url).origin;
      const token = btoa(session);
      const link = `${origin}/api/access-login?token=${encodeURIComponent(token)}&return=${encodeURIComponent(returnTo)}`;

      if (env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: '2nth.ai <hello@2nth.ai>',
            to: [email],
            subject: 'Your sign-in link — 2nth.ai Partner Portal',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;margin-bottom:16px;font-weight:700">2NTH.AI PARTNER PORTAL</div>
                <p style="font-size:15px;color:#1c1917;margin-bottom:8px">Hi ${esc(displayName)},</p>
                <p style="font-size:14px;color:#57534e;line-height:1.6">Click below to sign in to the partner portal:</p>
                <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;margin:16px 0">Sign in &rarr;</a>
                <p style="font-size:12px;color:#a8a29e;margin-top:16px">This link is valid for 30 days. Do not share it.</p>
              </div>
            `,
          }),
        });
      }

      return Response.json({ success: true, approved: true, sent: true, message: 'Sign-in link sent to ' + email });
    }

    // Direct sign-in — set cookie
    return Response.json(
      { success: true, approved: true, message: 'Signed in as ' + displayName },
      {
        headers: {
          'Set-Cookie': `dev_access=${btoa(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
        },
      }
    );
  }

  // Unknown user — need name for request
  if (!name) {
    return Response.json({ error: 'Name and email are required for access requests' }, { status: 400 });
  }

  // Send approval request email
  const resendKey = env.RESEND_API_KEY;
  if (resendKey) {
    const origin = new URL(request.url).origin;
    const approveSession = makeSession(email, name, 'luthuli,proximity-green');
    const approveToken = btoa(approveSession);
    const reviewers = getReviewers(returnTo);

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '2nth.ai <hello@2nth.ai>',
        to: reviewers,
        reply_to: email,
        subject: `[Access Request] ${name} — ${company || email}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;margin-bottom:16px;font-weight:700">2NTH.AI — ACCESS REQUEST</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#78716c;width:100px">Name</td><td style="padding:8px 0;color:#1c1917;font-weight:600">${esc(name)}</td></tr>
              <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0"><a href="mailto:${esc(email)}" style="color:#7c3aed">${esc(email)}</a></td></tr>
              <tr><td style="padding:8px 0;color:#78716c">Company</td><td style="padding:8px 0;color:#1c1917">${esc(company || '—')}</td></tr>
              <tr><td style="padding:8px 0;color:#78716c">Reason</td><td style="padding:8px 0;color:#1c1917">${esc(reason || '—')}</td></tr>
              <tr><td style="padding:8px 0;color:#78716c">Page</td><td style="padding:8px 0;color:#1c1917"><code>${esc(returnTo)}</code></td></tr>
            </table>
            <div style="margin-top:20px">
              <a href="${origin}/api/access-approve?token=${encodeURIComponent(approveToken)}&return=${encodeURIComponent(returnTo)}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none">Approve access</a>
            </div>
          </div>
        `,
      }),
    });
  }

  return Response.json({
    success: true,
    approved: false,
    message: 'Access request sent. You\'ll receive a sign-in link once approved.',
  });
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
