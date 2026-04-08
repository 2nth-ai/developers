// POST /api/partner/token — admin generates a signed preview URL for a partner
// Body: { key, email?, expiryDays? }
// Returns: { tokenUrl, token, expiresAt }

import { ADMIN_EMAILS, PARTNER_REGISTRY } from '../../lib/registry.js';
import { generatePreviewToken } from '../../lib/token.js';
import { resolveSession } from '../../lib/session.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const { email, role } = await resolveSession(request, env);
  if (!email || (!ADMIN_EMAILS.includes(email) && role !== 'admin')) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (!env.JWT_SECRET) {
    return Response.json({ error: 'JWT_SECRET not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, email: emailOverride, expiryDays = 30 } = body;
  if (!key) return Response.json({ error: 'key is required' }, { status: 400 });

  // Resolve partner email from registry or KV
  let partnerEmail = emailOverride;
  if (!partnerEmail) {
    const staticEntry = PARTNER_REGISTRY[key];
    if (staticEntry?.owners?.[0]) {
      partnerEmail = staticEntry.owners[0];
    } else if (env.KV) {
      const dynRaw = await env.KV.get(`partner_registry:${key}`);
      if (dynRaw) {
        try { partnerEmail = JSON.parse(dynRaw).email; } catch { /* ignore */ }
      }
    }
  }

  if (!partnerEmail) return Response.json({ error: `Could not resolve email for partner "${key}"` }, { status: 404 });

  const token = await generatePreviewToken(key, partnerEmail, env.JWT_SECRET, expiryDays);
  const siteUrl = env.SITE_URL || 'https://developers.2nth.ai';
  const tokenUrl = `${siteUrl}/partners/${key}?token=${token}`;
  const expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000).toISOString();

  return Response.json({ key, email: partnerEmail, token, tokenUrl, expiresAt });
}
