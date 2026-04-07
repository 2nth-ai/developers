// ═══════════════════════════════════════════════════════════════════
// Root middleware — site-wide partner gate
// ═══════════════════════════════════════════════════════════════════
//
// All content on developers.2nth.ai is private to verified partners.
// Non-partners who are authenticated are redirected to /register.html.
// Unauthenticated visitors are redirected to the sign-in flow.
//
// Public paths (no gate): /, /register.html, /portal.html (sign-in UI),
//   /api/auth/*, static assets (css/js/svg/ico)
// ═══════════════════════════════════════════════════════════════════

const ADMIN_EMAILS = ['craig@2nth.ai', 'craigl@2nth.ai', 'imbilawork@gmail.com'];
const BLOCKED_EMAILS = ['leppan.craig@gmail.com'];

// All verified partner owner emails
const PARTNER_EMAILS = [
  'albert@andilesolutions.com', 'neil@andilesolutions.com', 'craigl@andilesolutions.com',
  'hello@vibecrafters.co.za', 'vibecrafterza@gmail.com',
  'michael@agilex.co.za',
  'info@gridlineprop.co.za',
  'info@scanman.co.za',
  'info@proximity-green.co.za',
  'info@dronescan.co.za',
  'hyramserretta20@gmail.com',
  'carladeabreu@outlook.com',
  'nicola@gananda.net',
];

// Paths that are always public (no gate)
const PUBLIC_PATHS = [
  '/',
  '/register.html',
  '/portal.html',   // sign-in UI lives here
];

// Path prefixes that are always public (static assets, auth API)
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/style.css',
  '/gate.js',
  '/portal.js',
  '/signin.js',
  '/favicon',
];

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
  // Static asset extensions
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

  // ── Admin → always allow ─────────────────────────────────────────
  if (ADMIN_EMAILS.includes(email) || role === 'admin') return next();

  // ── Verified partner → allow ─────────────────────────────────────
  if (PARTNER_EMAILS.includes(email)) return next();

  // ── Authenticated but not a partner → registration page ──────────
  return new Response(null, {
    status: 302,
    headers: { Location: `/register.html?ref=gate&email=${encodeURIComponent(email)}` },
  });
}
