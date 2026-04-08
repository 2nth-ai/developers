// GET  /api/partner/profile?key=xxx — get partner's own profile
// POST /api/partner/profile — partner updates their own profile
//
// Partners can only update their own record. Admins can update any.

import { ADMIN_EMAILS } from '../../lib/registry.js';
import { resolveSession } from '../../lib/session.js';
import { getPartner, getPartnerByEmail, updatePartnerProfile } from '../../lib/partners.js';

function isAdmin(email, role) {
  return ADMIN_EMAILS.includes(email) || role === 'admin';
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session?.email) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  const key = new URL(request.url).searchParams.get('key');

  let partner;
  if (key) {
    // Admins can fetch any partner; others must own it
    partner = await getPartner(env, key);
    if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });
    const ownerEmails = partner.emails || (partner.email ? [partner.email] : []);
    if (!isAdmin(session.email, session.role) && !ownerEmails.includes(session.email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    // No key — return the caller's own partner record
    partner = await getPartnerByEmail(env, session.email);
    if (!partner) return Response.json({ error: 'No partner profile found for this account' }, { status: 404 });
  }

  return Response.json({ partner });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session?.email) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Resolve which partner key to update
  let key = body.key;
  if (!key) {
    const own = await getPartnerByEmail(env, session.email);
    if (!own) return Response.json({ error: 'No partner profile found for this account' }, { status: 404 });
    key = own.key;
  }

  // Verify permission
  const partner = await getPartner(env, key);
  if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });
  const ownerEmails = partner.emails || (partner.email ? [partner.email] : []);
  if (!isAdmin(session.email, session.role) && !ownerEmails.includes(session.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Only KV-stored partners can be updated this way
  const raw = await env.KV?.get(`partner:${key}`);
  if (!raw) {
    return Response.json({
      error: 'This partner profile is managed via the static registry. Contact an admin to migrate it.',
    }, { status: 422 });
  }

  const { name, company, visibility, profile } = body;
  const updated = await updatePartnerProfile(env, key, { name, company, visibility, profile });

  return Response.json({ ok: true, partner: updated });
}
