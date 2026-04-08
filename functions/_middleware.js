// ═══════════════════════════════════════════════════════════════════
// Root middleware — site-wide partner gate
// ═══════════════════════════════════════════════════════════════════
//
// All content on developers.2nth.ai is private to verified partners.
// Access tiers:
//   1. Admin (ADMIN_EMAILS / role=admin)    → all pages
//   2. Verified partner (in PARTNER_REGISTRY) → all pages + per-partner rules
//   3. Authenticated non-partner           → /register.html
//   4. Unauthenticated                     → sign-in (portal.html)
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

import { resolveSession } from './lib/session.js';

const PUBLIC_PATHS = ['/', '/register.html', '/portal.html'];
const PUBLIC_PREFIXES = ['/api/auth/', '/style.css', '/gate.js', '/portal.js', '/signin.js', '/favicon'];
const ADMIN_ONLY_PATHS = ['/onboard.html', '/api/partner/onboard'];

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
    console.log(`[gate] → redirect to sign-in (no session)`);
    return new Response(null, {
      status: 302,
      headers: { Location: `/portal.html?return=${encodeURIComponent(path)}` },
    });
  }

  // ── Blocked → hard deny ──────────────────────────────────────────
  if (BLOCKED_EMAILS.includes(email)) {
    console.log(`[gate] → blocked email`);
    return new Response(null, {
      status: 302,
      headers: { Location: '/register.html?blocked=1' },
    });
  }

  // ── Admin-only paths ─────────────────────────────────────────────
  if (ADMIN_ONLY_PATHS.some(p => path.startsWith(p))) {
    if (!isAdmin(email, role)) {
      console.log(`[gate] → admin-only path, denied`);
      return new Response(null, { status: 302, headers: { Location: '/portal.html' } });
    }
    console.log(`[gate] → admin-only path, allowed`);
    return next();
  }

  // ── Admin → always allow ─────────────────────────────────────────
  if (isAdmin(email, role)) {
    console.log(`[gate] → admin, allowed`);
    return next();
  }

  // ── Not a partner at all → registration page ─────────────────────
  if (!isPartner(email)) {
    console.log(`[gate] → not a partner, denied`);
    return new Response(null, {
      status: 302,
      headers: { Location: `/register.html?ref=gate&email=${encodeURIComponent(email)}` },
    });
  }

  // ── Per-page partner privacy check for /partners/* ───────────────
  if (path.startsWith('/partners/')) {
    const partnerKey = resolvePartnerKey(path);

    if (partnerKey && PARTNER_REGISTRY[partnerKey]) {
      if (isOwner(email, partnerKey)) {
        console.log(`[gate] → owner of ${partnerKey}, allowed`);
        return next();
      }

      const [audienceAll, audiencePartners] = await Promise.all([
        env.KV.get(`partner_public:${partnerKey}:all`),
        env.KV.get(`partner_public:${partnerKey}:partners`),
      ]);

      if (audienceAll === 'true') return next();
      if (audiencePartners === 'true') return next();

      const inviteRaw = await env.KV.get(`partner_invite:${partnerKey}:${email}`);
      if (inviteRaw) {
        try {
          const inv = JSON.parse(inviteRaw);
          if (inv.active) return next();
        } catch { /* ignore */ }
      }

      if (INDIVIDUAL_PARTNERS.has(partnerKey)) {
        console.log(`[gate] → individual partner page, denied`);
        return new Response(null, {
          status: 302,
          headers: { Location: `/portal.html?access=restricted&partner=${encodeURIComponent(partnerKey)}` },
        });
      }

      return next(); // Org page default: visible to all partners
    }
  }

  // ── Verified partner → allow all other pages ─────────────────────
  console.log(`[gate] → verified partner, allowed`);
  return next();
}
