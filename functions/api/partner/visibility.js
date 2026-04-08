// POST /api/partner/visibility — set audience (all | partners | private)
// GET  ?key=xxx — get current audience setting
//
// Only the partner's owners or admins can modify.

import { PARTNER_REGISTRY, ADMIN_EMAILS } from '../../lib/registry.js';

function parseCookie(header, name) {
  const m = (header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

async function resolveSession(request, env) {
  const sid = parseCookie(request.headers.get('Cookie') || '', 'sid');
  if (sid && env.KV) {
    const raw = await env.KV.get(`session:${sid}`);
    if (raw) {
      try { const s = JSON.parse(raw); return { email: s.email?.toLowerCase(), role: s.role }; }
      catch { /* ignore */ }
    }
  }
  return null;
}

function canManage(session, partnerKey) {
  if (!session) return false;
  if (ADMIN_EMAILS.includes(session.email) || session.role === 'admin') return true;
  return PARTNER_REGISTRY[partnerKey]?.owners.includes(session.email) ?? false;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  const key = new URL(request.url).searchParams.get('key');
  if (!key || !PARTNER_REGISTRY[key]) return Response.json({ error: 'Unknown partner key' }, { status: 404 });
  if (!canManage(session, key)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const [all, partners] = await Promise.all([
    env.KV.get(`partner_public:${key}:all`),
    env.KV.get(`partner_public:${key}:partners`),
  ]);

  let audience = 'private';
  if (all === 'true') audience = 'all';
  else if (partners === 'true') audience = 'partners';

  return Response.json({ key, audience });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { partnerKey, audience } = body;
  if (!partnerKey || !['all', 'partners', 'private'].includes(audience)) {
    return Response.json({ error: 'partnerKey and audience (all|partners|private) required' }, { status: 400 });
  }
  if (!PARTNER_REGISTRY[partnerKey]) return Response.json({ error: 'Unknown partner key' }, { status: 404 });
  if (!canManage(session, partnerKey)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  await Promise.all([
    env.KV.put(`partner_public:${partnerKey}:all`,      audience === 'all'      ? 'true' : 'false'),
    env.KV.put(`partner_public:${partnerKey}:partners`, audience === 'partners' ? 'true' : 'false'),
  ]);

  return Response.json({ key: partnerKey, audience, updated: true });
}
