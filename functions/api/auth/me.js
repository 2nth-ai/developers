// GET /api/auth/me — return current user capabilities
// Used by frontend to make access decisions without hardcoded email lists.
// Response: { user, isAdmin, isPartner, partnerKeys }

import { resolveSession } from '../../lib/session.js';
import { isAdmin, isPartner, PARTNER_REGISTRY } from '../../lib/registry.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { email, role } = await resolveSession(request, env);

  if (!email) {
    return Response.json({ user: null, isAdmin: false, isPartner: false, partnerKeys: [] }, { status: 401 });
  }

  const adminFlag = isAdmin(email, role);
  const partnerFlag = isPartner(email) || adminFlag;

  // Static partner keys this email owns
  const partnerKeys = Object.entries(PARTNER_REGISTRY)
    .filter(([, v]) => v.owners.includes(email))
    .map(([k]) => k);

  // Dynamic KV-registered partner
  if (env.KV) {
    try {
      const dynRaw = await env.KV.get(`partner_email:${email}`);
      if (dynRaw) {
        const d = JSON.parse(dynRaw);
        if (d.key && !partnerKeys.includes(d.key)) partnerKeys.push(d.key);
      }
    } catch { /* ignore */ }
  }

  return Response.json({
    user: { email, name: email.split('@')[0], role },
    isAdmin: adminFlag,
    isPartner: partnerFlag,
    partnerKeys,
  });
}
