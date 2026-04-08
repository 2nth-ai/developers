// ═══════════════════════════════════════════════════════════════════
// Root middleware — site-wide partner gate + per-page partner privacy
// ═══════════════════════════════════════════════════════════════════
//
// All content on developers.2nth.ai is private to verified partners.
// Non-partners who are authenticated are redirected to /register.html.
// Unauthenticated visitors are redirected to the sign-in flow.
//
// Per-page partner privacy (/partners/* paths):
//   Individual partner pages are private by default — visible only to:
//     1. Admins
//     2. The partner's registered owner email(s)
//     3. Anyone explicitly invited via /api/partner/invite
//     4. All authenticated partners, if audience=partners
//     5. Everyone, if audience=all
//   Org/company pages default to visible to all authenticated partners.
// ═══════════════════════════════════════════════════════════════════

import {
  PARTNER_REGISTRY,
  INDIVIDUAL_PARTNERS,
  BLOCKED_EMAILS,
  isAdmin,
  isPartner,
  isOwner,
  resolvePartnerKey,
} from './lib/registry.js';

const PUBLIC_PATHS = ['/', '/register.html', '/portal.html'];
const PUBLIC_PREFIXES = ['/api/auth/', '/style.css', '/gate.js', '/portal.js', '/signin.js', '/favicon'];
const ADMIN_ONLY_PATHS = ['/onboard.html', '/api/partner/onboard'];

function parseCookie(header, name) {
  const m = (header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function getSSOEmail(cookie, secret) {
  if (!secret || !cookie) return null;
  const [h, p, s] = cookie.split('.');
  if (!h || !p || !s) return null;
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: payload.email, role: payload.role };
  } catch { return null; }
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // ── Always-public paths ──────────────────────────────────────────
  if (PUBLIC_PATHS.includes(path)) return next();
  if (PUBLIC_PREFIXES.some(p => path.startsWith(p))) return next();
  if (/\.(css|js|svg|ico|png|jpg|webp|woff2?|ttf)$/.test(path)) return next();

  // ── Resolve session ──────────────────────────────────────────────
  let email = null;
  let role  = null;
  const cookies = request.headers.get('Cookie') || '';

  const sid = parseCookie(cookies, 'sid');
  if (sid && env.KV) {
    const raw = await env.KV.get(`session:${sid}`);
    if (raw) {
      try { const s = JSON.parse(raw); email = s.email?.toLowerCase(); role = s.role; }
      catch { /* ignore */ }
    }
  }

  if (!email) {
    const sso = await getSSOEmail(parseCookie(cookies, '2nth_session'), env.JWT_SECRET);
    if (sso) { email = sso.email?.toLowerCase(); role = sso.role; }
  }

  // ── Not authenticated → sign in ──────────────────────────────────
  if (!email) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/portal.html?return=${encodeURIComponent(path)}` },
    });
  }

  // ── Blocked → hard deny ──────────────────────────────────────────
  if (BLOCKED_EMAILS.includes(email)) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/register.html?blocked=1' },
    });
  }

  // ── Admin-only paths — deny non-admins before any other check ────
  if (ADMIN_ONLY_PATHS.some(p => path.startsWith(p))) {
    if (!isAdmin(email, role)) {
      return new Response(null, { status: 302, headers: { Location: '/portal.html' } });
    }
    return next();
  }

  // ── Admin → always allow ─────────────────────────────────────────
  const ADMIN_LIST = ['craig@2nth.ai','craigl@2nth.ai','craig@b2bs.co.za','imbilawork@gmail.com'];
  if (ADMIN_LIST.includes(email) || role === 'admin' || isAdmin(email, role)) return next();

  // ── Not a partner at all → registration page ─────────────────────
  if (!isPartner(email)) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/register.html?ref=gate&email=${encodeURIComponent(email)}` },
    });
  }

  // ── Per-page partner privacy check for /partners/* ───────────────
  if (path.startsWith('/partners/')) {
    const partnerKey = resolvePartnerKey(path);

    if (partnerKey && PARTNER_REGISTRY[partnerKey]) {
      // Owner of this page → always allow
      if (isOwner(email, partnerKey)) return next();

      // Check KV audience setting set by the partner
      const [audienceAll, audiencePartners] = await Promise.all([
        env.KV.get(`partner_public:${partnerKey}:all`),
        env.KV.get(`partner_public:${partnerKey}:partners`),
      ]);

      if (audienceAll === 'true') return next();
      if (audiencePartners === 'true') return next();

      // Check for an explicit invite
      const inviteRaw = await env.KV.get(`partner_invite:${partnerKey}:${email}`);
      if (inviteRaw) {
        try {
          const inv = JSON.parse(inviteRaw);
          if (inv.active) return next();
        } catch { /* ignore */ }
      }

      // Individual partner pages default to private
      if (INDIVIDUAL_PARTNERS.has(partnerKey)) {
        return new Response(null, {
          status: 302,
          headers: { Location: `/portal.html?access=restricted&partner=${encodeURIComponent(partnerKey)}` },
        });
      }

      // Org pages with no explicit visibility → visible to all partners
      return next();
    }
  }

  // ── Verified partner → allow all other pages ─────────────────────
  return next();
}
