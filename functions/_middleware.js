// ═══════════════════════════════════════════════════════════════════
// Root middleware — site-wide partner gate
// ═══════════════════════════════════════════════════════════════════
//
// All content on developers.2nth.ai is private to verified partners.
// Access tiers:
//   1. Admin (ADMIN_EMAILS / role=admin)       → all pages
//   2. Active partner (KV or registry)         → all shared pages + per-partner rules
//   3. Authenticated but not a partner         → /register.html
//   4. Unauthenticated                         → / (sign-in page)
// ═══════════════════════════════════════════════════════════════════

import { BLOCKED_EMAILS, isAdmin } from './lib/registry.js';
import { isActivePartner, resolvePartnerKey, isOwner, getPartner } from './lib/partners.js';
import { resolveSession } from './lib/session.js';

// Public — no auth required
const PUBLIC_PATHS = ['/', '/register.html', '/portal.html'];
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/partner/register',   // partner self-registration is public
  '/style.css', '/gate.js', '/portal.js', '/signin.js', '/favicon',
];

// Admin-only paths
const ADMIN_ONLY_PATHS = ['/onboard.html', '/admin.html', '/api/partner/onboard', '/api/partner/approve'];

function signIn(path) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/?return=${encodeURIComponent(path)}` },
  });
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
  const { email, role, source } = await resolveSession(request, env);
  console.log(`[gate] path=${path} email=${email || 'none'} role=${role || 'none'} source=${source || 'none'}`);

  // ── Not authenticated → sign in ──────────────────────────────────
  if (!email) {
    console.log(`[gate] → no session, redirect to sign-in`);
    return signIn(path);
  }

  // ── Blocked → hard deny ──────────────────────────────────────────
  if (BLOCKED_EMAILS.includes(email)) {
    console.log(`[gate] → blocked`);
    return new Response(null, { status: 302, headers: { Location: '/register.html?blocked=1' } });
  }

  // ── Admin-only paths ─────────────────────────────────────────────
  if (ADMIN_ONLY_PATHS.some(p => path.startsWith(p))) {
    if (!isAdmin(email, role)) {
      console.log(`[gate] → admin-only, denied`);
      return new Response(null, { status: 302, headers: { Location: '/portal.html' } });
    }
    console.log(`[gate] → admin-only, allowed`);
    return next();
  }

  // ── Admin → always allow ─────────────────────────────────────────
  if (isAdmin(email, role)) {
    console.log(`[gate] → admin, allowed`);
    return next();
  }

  // ── Active partner check (KV + static registry) ──────────────────
  const partnerActive = await isActivePartner(env, email);
  if (!partnerActive) {
    console.log(`[gate] → not a partner, redirect to register`);
    return new Response(null, {
      status: 302,
      headers: { Location: `/register.html?ref=gate&email=${encodeURIComponent(email)}` },
    });
  }

  // ── /partners/* — per-page access rules ──────────────────────────
  if (path.startsWith('/partners/')) {
    const partnerKey = await resolvePartnerKey(env, path);
    if (partnerKey) {
      // Owner always has access
      if (await isOwner(env, email, partnerKey)) {
        console.log(`[gate] → owner of ${partnerKey}, allowed`);
        return next();
      }

      const partner = await getPartner(env, partnerKey);
      const visibility = partner?.visibility || 'private';

      if (visibility === 'public') return next();
      if (visibility === 'partners') { return next(); } // already confirmed they're a partner above

      // private — check explicit invite
      const inviteRaw = await env.KV?.get(`partner_invite:${partnerKey}:${email}`);
      if (inviteRaw) {
        try {
          const inv = JSON.parse(inviteRaw);
          if (inv.active) { return next(); }
        } catch { /* ignore */ }
      }

      console.log(`[gate] → private page, denied`);
      return new Response(null, {
        status: 302,
        headers: { Location: `/portal.html?access=restricted&partner=${encodeURIComponent(partnerKey)}` },
      });
    }
  }

  // ── Verified partner → allow all other pages ─────────────────────
  console.log(`[gate] → active partner, allowed`);
  return next();
}
