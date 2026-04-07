// ═══════════════════════════════════════════════════════════════════
// Partner page visibility middleware
// ═══════════════════════════════════════════════════════════════════
//
// Visibility tiers (in order of precedence):
//   1. Admin (craig@2nth.ai or session.role === 'admin') → all pages
//   2. Page owner (email in PARTNER_OWNERS[key]) → their own pages
//   3. Other authenticated users → only pages the partner has made public
//   4. Unauthenticated → redirect to sign-in
//
// "Make public" is a KV toggle per partner: partner_public:{key} → "true"
// Partners can flip this from their profile once that UI is built.
// ═══════════════════════════════════════════════════════════════════

// Map page path-prefix → partner key + owner emails
const PARTNER_REGISTRY = {
  'andile': {
    owners: [
      'albert@andilesolutions.com',
      'neil@andilesolutions.com',
      'craigl@andilesolutions.com',
    ],
  },
  'vibecrafters': {
    owners: ['hello@vibecrafters.co.za'],
  },
  'agilex': {
    owners: ['info@agilex.co.za', 'mike@agilex.co.za'],
  },
  'gridlineprop': {
    owners: ['info@gridlineprop.co.za'],
  },
  'scanman': {
    owners: ['info@scanman.co.za'],
  },
  'proximity-green': {
    owners: ['info@proximity-green.co.za'],
  },
  'dronescan': {
    owners: ['info@dronescan.co.za'],
  },
  'hyram': {
    owners: ['hyramserretta20@gmail.com'],
  },
  'carla': {
    owners: ['carladeabreu@outlook.com'],
  },
};

// Admin emails — always see everything
const ADMIN_EMAILS = ['craig@2nth.ai', 'craigl@2nth.ai', 'imbilawork@gmail.com'];

// ── Helpers ──────────────────────────────────────────────────────────

function parseCookie(header, name) {
  const match = (header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : null;
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
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

// Resolve the partner key from the request path
// e.g. /partners/andile-frtb.html → 'andile'
function resolvePartnerKey(pathname) {
  // Strip leading /partners/
  const rest = pathname.replace(/^\/partners\//, '');
  // Match longest key first (handles 'proximity-green' before 'proximity')
  const keys = Object.keys(PARTNER_REGISTRY).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (rest === key + '.html' || rest.startsWith(key + '-') || rest.startsWith(key + '.')) {
      return key;
    }
  }
  return null;
}

function denyPage(returnPath) {
  return new Response(null, {
    status: 302,
    headers: { Location: `https://2nth.ai/?return=${encodeURIComponent('https://developers.2nth.ai' + returnPath)}` },
  });
}

// ── Main middleware ───────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const cookies = request.headers.get('Cookie') || '';

  // ── 1. Resolve authenticated user ──────────────────────────────────
  let email = null;
  let role = null;

  // OTP session (developers portal)
  const sid = parseCookie(cookies, 'sid');
  if (sid && env.KV) {
    const raw = await env.KV.get(`session:${sid}`);
    if (raw) {
      try {
        const session = JSON.parse(raw);
        email = session.email?.toLowerCase();
        role = session.role; // 'admin' | 'developer'
      } catch { /* malformed session */ }
    }
  }

  // SSO JWT (2nth.ai main platform) — only if OTP session didn't resolve
  if (!email) {
    const ssoToken = parseCookie(cookies, '2nth_session');
    const sso = await getSSOEmail(ssoToken, env.JWT_SECRET);
    if (sso) {
      email = sso.email?.toLowerCase();
      role = sso.role;
    }
  }

  // Not authenticated at all → send to sign-in
  if (!email) {
    return denyPage(url.pathname);
  }

  // ── 2. Admin check — sees everything ───────────────────────────────
  if (role === 'admin' || ADMIN_EMAILS.includes(email)) {
    return next();
  }

  // ── 3. Resolve which partner page this is ─────────────────────────
  const partnerKey = resolvePartnerKey(url.pathname);

  // No partner key → generic auth-only page, allow any signed-in user
  if (!partnerKey) {
    return next();
  }

  const partner = PARTNER_REGISTRY[partnerKey];

  // Unknown partner key → allow authenticated users through
  if (!partner) {
    return next();
  }

  // ── 4. Owner check — partner sees their own pages ─────────────────
  if (partner.owners.includes(email)) {
    return next();
  }

  // ── 5. Public opt-in — check KV flag set by partner ───────────────
  // Partner can set partner_public:{key}:all → "true"  (visible to all registered users)
  // Partner can set partner_public:{key}:partners → "true"  (visible to other partners)
  if (env.KV) {
    const publicAll = await env.KV.get(`partner_public:${partnerKey}:all`);
    if (publicAll === 'true') return next();

    // Check if the requesting user is themselves a partner (owns any other page)
    const isPartner = Object.values(PARTNER_REGISTRY).some(p => p.owners.includes(email));
    if (isPartner) {
      const publicToPartners = await env.KV.get(`partner_public:${partnerKey}:partners`);
      if (publicToPartners === 'true') return next();
    }
  }

  // ── 6. Access denied — authenticated but no permission ────────────
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/portal.html?access=denied&partner=${encodeURIComponent(partnerKey)}`,
    },
  });
}
