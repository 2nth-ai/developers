// POST   /api/partner/invite  — grant access to an email
// DELETE /api/partner/invite  — revoke access
// GET    /api/partner/invite?key=xxx — list invites + access log

import { ADMIN_EMAILS } from '../../lib/registry.js';
import { resolveSession } from '../../lib/session.js';
import { getOwners, resolvePartnerKey } from '../../lib/partners.js';

async function canManage(env, session, partnerKey) {
  if (!session?.email) return false;
  if (ADMIN_EMAILS.includes(session.email) || session.role === 'admin') return true;
  const owners = await getOwners(env, partnerKey);
  return owners.some(o => o.toLowerCase() === session.email.toLowerCase());
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  const key = new URL(request.url).searchParams.get('key');

  if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
  if (!await canManage(env, session, key)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const inviteList = await env.KV.list({ prefix: `partner_invite:${key}:` });
  const invites = await Promise.all(
    inviteList.keys.map(async ({ name }) => {
      const raw = await env.KV.get(name);
      try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    })
  );

  const logList = await env.KV.list({ prefix: `partner_access:${key}:` });
  const logs = await Promise.all(
    logList.keys.slice(-50).map(async ({ name }) => {
      const raw = await env.KV.get(name);
      try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    })
  );

  return Response.json({
    key,
    invites: invites.filter(Boolean),
    accessLog: logs.filter(Boolean).sort((a, b) => b.ts > a.ts ? 1 : -1),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { partnerKey, email } = body;
  if (!partnerKey || !email) return Response.json({ error: 'partnerKey and email required' }, { status: 400 });
  if (!await canManage(env, session, partnerKey)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const normalEmail = email.toLowerCase().trim();
  const invite = {
    partnerKey,
    email: normalEmail,
    grantedBy: session.email,
    grantedAt: new Date().toISOString(),
    active: true,
  };

  await env.KV.put(`partner_invite:${partnerKey}:${normalEmail}`, JSON.stringify(invite));
  return Response.json({ granted: true, invite });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { partnerKey, email } = body;
  if (!partnerKey || !email) return Response.json({ error: 'partnerKey and email required' }, { status: 400 });
  if (!await canManage(env, session, partnerKey)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const normalEmail = email.toLowerCase().trim();
  const kvKey = `partner_invite:${partnerKey}:${normalEmail}`;

  const existing = await env.KV.get(kvKey);
  let invite = {};
  try { invite = existing ? JSON.parse(existing) : {}; } catch { /* ignore */ }

  invite.active    = false;
  invite.revokedBy = session.email;
  invite.revokedAt = new Date().toISOString();

  await env.KV.put(kvKey, JSON.stringify(invite));
  return Response.json({ revoked: true, email: normalEmail });
}
