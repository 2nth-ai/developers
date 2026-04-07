// GET  /api/auth/login — redirect to GitHub OAuth
// POST /api/auth/login — send OTP to email

export async function onRequestGet(context) {
  const { env } = context;
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: 'read:user user:email public_repo',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      'Set-Cookie': `gh_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return Response.json({ ok: false, error: 'Valid email required' }, { status: 400 });
  }

  if (!env.KV) {
    return Response.json({ ok: false, error: 'KV binding not configured' }, { status: 503 });
  }

  // Generate 6-digit code
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const code = String(100000 + (arr[0] % 900000));

  // Store in KV with 10-min TTL
  await env.KV.put(`otp:${email}`, code, { expirationTtl: 600 });

  // Send via Resend
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || '2NTH Developers <hello@2nth.ai>',
        to: email,
        subject: '2nth Developers — your sign-in code',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
            <div style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:3px;margin-bottom:24px">2NTH DEVELOPERS</div>
            <p style="font-size:15px;color:#333;margin-bottom:8px">Your sign-in code:</p>
            <div style="font-family:monospace;font-size:40px;font-weight:700;letter-spacing:10px;color:#06B6D4;margin:24px 0;padding:20px;background:#f0fdff;border-radius:6px;text-align:center">${code}</div>
            <p style="font-size:13px;color:#666">This code expires in 10 minutes. Enter it on the sign-in page to continue.</p>
            <p style="font-size:12px;color:#999;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.error('Resend error:', e);
  }

  return Response.json({ ok: true });
}
