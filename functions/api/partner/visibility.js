// GET  /api/partner/visibility?key=xxx — get current visibility setting
// POST /api/partner/visibility — set visibility (private | partners | public)
//
// Only the partner's owners or admins can modify.

import { ADMIN_EMAILS } from '../../lib/registry.js';
import { resolveSession } from '../../lib/session.js';
import { getOwners, updatePartnerProfile } from '../../lib/partners.js';

async function canManage(env, session, partnerKey) {
  if (!session?.email) return false;
  if (ADMIN_EMAILS.includes(session.email) || session.role === 'admin') return true;
  const owners = await getOwners(env, partnerKey);
  return owners.some(o => o.toLowerCase() === session.email.toLowerCase());
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session?.email) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  const key = new URL(request.url).searchParams.get('key');
  if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
  if (!await canManage(env, session, key)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // KV-based partners store visibility on the record itself
  const raw = await env.KV?.get(`partner:${key}`);
  if (raw) {
    try {
      const record = JSON.parse(raw);
      return Response.json({ key, visibility: record.visibility || 'private' });
    } catch { /* fall through */ }
  }

  // Legacy: check old partner_public keys for static partners
  const [all, partners] = await Promise.all([
    env.KV?.get(`partner_public:${key}:all`),
    env.KV?.get(`partner_public:${key}:partners`),
  ]);

  let visibility = 'private';
  if (all === 'true') visibility = 'public';
  else if (partners === 'true') visibility = 'partners';

  return Response.json({ key, visibility });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session?.email) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { partnerKey, visibility } = body;
  if (!partnerKey || !['public', 'partners', 'private'].includes(visibility)) {
    return Response.json({ error: 'partnerKey and visibility (public|partners|private) required' }, { status: 400 });
  }
  if (!await canManage(env, session, partnerKey)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // Update KV-based partner record if it exists
  const raw = await env.KV?.get(`partner:${partnerKey}`);
  if (raw) {
    await updatePartnerProfile(env, partnerKey, { visibility });
  } else {
    // Legacy: set old-style partner_public keys for static partners
    await Promise.all([
      env.KV?.put(`partner_public:${partnerKey}:all`,      visibility === 'public'    ? 'true' : 'false'),
      env.KV?.put(`partner_public:${partnerKey}:partners`, visibility === 'partners'  ? 'true' : 'false'),
    ]);
  }

  return Response.json({ key: partnerKey, visibility, updated: true });
}
