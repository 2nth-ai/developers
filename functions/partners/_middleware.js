// ═══════════════════════════════════════════════════════════════════
// /partners/* middleware — per-page partner visibility
// ═══════════════════════════════════════════════════════════════════
//
// Access tiers (in precedence order):
//   1. Admin (ADMIN_EMAILS / role=admin)      → all pages
//   2. SSO session (sid / 2nth_session JWT)   → owner or invited
//   3. Partner preview session cookie (pps)   → their own page
//   4. Signed token URL (?token=...)          → their own page, sets pps cookie
//   5. Audience=all / Audience=partners       → any logged-in partner
//   Default individual pages: private
//   Default org pages: visible to all authenticated partners
// ═══════════════════════════════════════════════════════════════════

import {
  PARTNER_REGISTRY,
  INDIVIDUAL_PARTNERS,
  BLOCKED_EMAILS,
  isAdmin,
  isOwner,
  resolvePartnerKey,
} from '../lib/registry.js';

import {
  validatePreviewToken,
  validatePPSession,
  createPPSession,
  ppsCookieHeader,
  PPS_COOKIE,
} from '../lib/token.js';

import { resolveSession } from '../lib/session.js';

function parseCookie(header, name) {
  const m = (header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

async function logAccess(env, partnerKey, email, path) {
  if (!env.KV || !partnerKey) return;
  await env.KV.put(
    `partner_access:${partnerKey}:${email}:${Date.now()}`,
    JSON.stringify({ path, ts: new Date().toISOString(), email }),
    { expirationTtl: 60 * 60 * 24 * 90 }
  );
}

async function resolveKey(path, env) {
  const staticKey = resolvePartnerKey(path);
  if (staticKey) return { key: staticKey, dynamic: false };

  const slug = path.replace(/^\/partners\//, '').replace(/\.html$/, '').replace(/\/$/, '');
  if (!slug || slug === 'index') return { key: null };

  const dynRaw = env.KV ? await env.KV.get(`partner_registry:${slug}`) : null;
  if (dynRaw) {
    try {
      const reg = JSON.parse(dynRaw);
      if (reg.active !== false) return { key: slug, dynamic: true, reg };
    } catch { /* ignore */ }
  }
  return { key: null };
}

function deny(partnerKey) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/portal.html?access=restricted&partner=${encodeURIComponent(partnerKey || '')}` },
  });
}

function signIn(path) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/portal.html?return=${encodeURIComponent(path)}` },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const cookies = request.headers.get('Cookie') || '';

  const { key: partnerKey, dynamic, reg } = await resolveKey(url.pathname, env);
  const owners = dynamic ? (reg?.owners || []) : (PARTNER_REGISTRY[partnerKey]?.owners || []);
  const isIndividual = dynamic
    ? (reg?.individual === true)
    : INDIVIDUAL_PARTNERS.has(partnerKey);

  // ── 1. Signed token URL (?token=...) ────────────────────────────
  // Validate first — no auth required, just a valid HMAC token
  const tokenParam = url.searchParams.get('token');
  if (tokenParam && partnerKey && env.JWT_SECRET) {
    const claim = await validatePreviewToken(tokenParam, env.JWT_SECRET);
    if (claim && claim.key === partnerKey) {
      // Valid token for this page — create a PPS cookie session and pass through
      const sessionId = await createPPSession(env.KV, partnerKey, claim.email);
      await logAccess(env, partnerKey, claim.email, url.pathname);

      // Strip the token from the URL and redirect with cookie set
      const cleanUrl = new URL(url.toString());
      cleanUrl.searchParams.delete('token');
      return new Response(null, {
        status: 302,
        headers: {
          Location: cleanUrl.toString(),
          'Set-Cookie': ppsCookieHeader(sessionId),
        },
      });
    }
    // Invalid/expired token — fall through to other auth methods
  }

  // ── 2. Partner preview session cookie (pps) ──────────────────────
  const ppsId = parseCookie(cookies, PPS_COOKIE);
  if (ppsId && partnerKey) {
    const ppsClaim = await validatePPSession(env.KV, ppsId);
    if (ppsClaim && ppsClaim.key === partnerKey) {
      await logAccess(env, partnerKey, ppsClaim.email, url.pathname);
      return next();
    }
  }

  // ── 3. SSO session ───────────────────────────────────────────────
  const { email, role } = await resolveSession(request, env);

  if (BLOCKED_EMAILS.includes(email)) {
    return new Response(null, { status: 302, headers: { Location: '/register.html?blocked=1' } });
  }

  // Admin → always pass
  if (isAdmin(email, role)) {
    await logAccess(env, partnerKey, email || 'admin', url.pathname);
    return next();
  }

  // No session at all → show sign-in (but only if no token was present, otherwise deny)
  if (!email) {
    if (tokenParam) return deny(partnerKey); // token was invalid
    return signIn(url.pathname);
  }

  if (!partnerKey) return next(); // unknown slug, let it 404

  // Owner → allow
  if (isOwner(email, partnerKey) || owners.includes(email)) {
    await logAccess(env, partnerKey, email, url.pathname);
    return next();
  }

  // ── 4. KV audience setting ───────────────────────────────────────
  const [audienceAll, audiencePartners] = await Promise.all([
    env.KV.get(`partner_public:${partnerKey}:all`),
    env.KV.get(`partner_public:${partnerKey}:partners`),
  ]);

  if (audienceAll === 'true') return next();

  if (audiencePartners === 'true') {
    const isAnyPartner = Object.values(PARTNER_REGISTRY).some(p => p.owners.includes(email))
      || !!(await env.KV.get(`partner_email:${email}`));
    if (isAnyPartner) { await logAccess(env, partnerKey, email, url.pathname); return next(); }
  }

  // ── 5. Explicit invite ───────────────────────────────────────────
  const inviteRaw = await env.KV.get(`partner_invite:${partnerKey}:${email}`);
  if (inviteRaw) {
    try {
      const inv = JSON.parse(inviteRaw);
      if (inv.active) { await logAccess(env, partnerKey, email, url.pathname); return next(); }
    } catch { /* ignore */ }
  }

  // ── 6. Org default: visible to all partners ──────────────────────
  if (!isIndividual) {
    const isStaticPartner = Object.values(PARTNER_REGISTRY).some(p => p.owners.includes(email));
    const dynEmailRaw = await env.KV.get(`partner_email:${email}`);
    if (isStaticPartner || dynEmailRaw) {
      await logAccess(env, partnerKey, email, url.pathname);
      return next();
    }
  }

  // Deny
  return deny(partnerKey);
}
