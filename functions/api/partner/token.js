// POST /api/partner/token — admin generates a signed preview URL for a partner
// Body: { key, email?, expiryDays? }
// Returns: { tokenUrl, token, expiresAt }
//
// The token URL can be sent directly to the partner — no account required.

import { ADMIN_EMAILS, PARTNER_REGISTRY } from '../../lib/registry.js';
import { generatePreviewToken } from '../../lib/token.js';

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

export async function onRequestPost(context) {
  const { request, env } = context;

  const session = await resolveSession(request, env);
  if (!session || (!ADMIN_EMAILS.includes(session.email) && session.role !== 'admin')) {
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
  let email = emailOverride;
  if (!email) {
    const staticEntry = PARTNER_REGISTRY[key];
    if (staticEntry?.owners?.[0]) {
      email = staticEntry.owners[0];
    } else if (env.KV) {
      const dynRaw = await env.KV.get(`partner_registry:${key}`);
      if (dynRaw) {
        try { email = JSON.parse(dynRaw).email; } catch { /* ignore */ }
      }
    }
  }

  if (!email) return Response.json({ error: `Could not resolve email for partner "${key}"` }, { status: 404 });

  const token = await generatePreviewToken(key, email, env.JWT_SECRET, expiryDays);
  const siteUrl = env.SITE_URL || 'https://developers.2nth.ai';
  const tokenUrl = `${siteUrl}/partners/${key}?token=${token}`;
  const expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000).toISOString();

  return Response.json({ key, email, token, tokenUrl, expiresAt });
}
