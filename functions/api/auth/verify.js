// POST /api/auth/verify — validate OTP code, create session

import { ADMIN_EMAILS } from '../../lib/registry.js';
import { sidCookieHeader } from '../../lib/session.js';

export async function onRequestPost(context) {
  const { env, request } = context;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  if (!email || !code) {
    return Response.json({ ok: false, error: 'Email and code required' }, { status: 400 });
  }

  if (!env.KV) {
    return Response.json({ ok: false, error: 'KV binding not configured' }, { status: 503 });
  }

  const stored = await env.KV.get(`otp:${email}`);
  if (!stored || stored !== code) {
    return Response.json({ ok: false, error: 'Invalid or expired code' }, { status: 401 });
  }

  // Consume OTP
  await env.KV.delete(`otp:${email}`);

  // Create session
  const sid = crypto.randomUUID().replace(/-/g, '');
  const user = {
    id: sid,
    email,
    name: email.split('@')[0],
    role: ADMIN_EMAILS.includes(email) ? 'admin' : 'developer',
    tier: 'email',
  };
  await env.KV.put(`session:${sid}`, JSON.stringify(user), { expirationTtl: 60 * 60 * 24 * 30 });

  return new Response(JSON.stringify({ ok: true, user }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sidCookieHeader(sid),
    },
  });
}
