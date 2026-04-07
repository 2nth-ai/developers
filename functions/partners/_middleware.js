// ═══════════════════════════════════════════════════════════════════
// Partner page visibility middleware
// ═══════════════════════════════════════════════════════════════════
//
// Access tiers (in order of precedence):
//   1. Blocked list → hard deny, always
//   2. Admin (ADMIN_EMAILS or role=admin) → all pages
//   3. Owner (email in PARTNER_REGISTRY[key].owners) → their own pages
//   4. Invited (KV: partner_invite:{key}:{email} is active) → that partner's pages
//   5. Everyone else → denied
//
// KV schema:
//   partner_invite:{key}:{email}  → JSON { grantedBy, grantedAt, active: true|false }
//   partner_access:{key}:{email}:{ts} → JSON { path, ts }  (access log)
// ═══════════════════════════════════════════════════════════════════

const PARTNER_REGISTRY = {
  'andile':          { owners: ['albert@andilesolutions.com','neil@andilesolutions.com','craigl@andilesolutions.com'] },
  'vibecrafters':    { owners: ['hello@vibecrafters.co.za','vibecrafterza@gmail.com'] },
  'agilex':          { owners: ['michael@agilex.co.za'] },
  'gridlineprop':    { owners: ['info@gridlineprop.co.za'] },
  'scanman':         { owners: ['info@scanman.co.za'] },
  'proximity-green': { owners: ['info@proximity-green.co.za'] },
  'dronescan':       { owners: ['info@dronescan.co.za'] },
  'hyram':           { owners: ['hyramserretta20@gmail.com'] },
  'carla':           { owners: ['carladeabreu@outlook.com'] },
  'nicola':          { owners: ['nicola@gananda.net'] },
  '20crm':           { owners: ['craig@2nth.ai'] },
};

const ADMIN_EMAILS  = ['craig@2nth.ai', 'craigl@2nth.ai', 'imbilawork@gmail.com'];
const BLOCKED_EMAILS = ['leppan.craig@gmail.com'];

// ── Helpers ─────────────────────────────────────────────────────────

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

// /partners/andile-frtb.html → 'andile'
function resolvePartnerKey(pathname) {
  const rest = pathname.replace(/^\/partners\//, '');
  const keys = Object.keys(PARTNER_REGISTRY).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (rest === key + '.html' || rest === key + '/' || rest === '' ||
        rest.startsWith(key + '-') || rest.startsWith(key + '.')) {
      return key;
    }
  }
  return null;
}

function redirectDeny(partnerKey) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/portal.html?access=denied&partner=${encodeURIComponent(partnerKey || 'restricted')}` },
  });
}

function redirectSignIn(returnPath) {
  return new Response(null, {
    status: 302,
    headers: { Location: `https://2nth.ai/?return=${encodeURIComponent('https://developers.2nth.ai' + returnPath)}` },
  });
}

async function logAccess(env, partnerKey, email, path) {
  if (!env.KV || !partnerKey) return;
  const ts = new Date().toISOString();
  const logKey = `partner_access:${partnerKey}:${email}:${Date.now()}`;
  await env.KV.put(logKey, JSON.stringify({ path, ts, email }), { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
}

// ── Main middleware ──────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const cookies = request.headers.get('Cookie') || '';

  // ── 1. Resolve session ─────────────────────────────────────────────
  let email = null;
  let role  = null;

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

  // Unauthenticated → sign-in
  if (!email) return redirectSignIn(url.pathname);

  // ── 2. Blocked list — hard deny ────────────────────────────────────
  if (BLOCKED_EMAILS.includes(email)) return redirectDeny('restricted');

  // ── 3. Admin — sees everything ─────────────────────────────────────
  if (role === 'admin' || ADMIN_EMAILS.includes(email)) {
    await logAccess(env, resolvePartnerKey(url.pathname), email, url.pathname);
    return next();
  }

  // ── 4. Resolve partner key ─────────────────────────────────────────
  const partnerKey = resolvePartnerKey(url.pathname);
  const partner    = partnerKey ? PARTNER_REGISTRY[partnerKey] : null;

  // ── 5. Owner check ─────────────────────────────────────────────────
  if (partner && partner.owners.includes(email)) {
    await logAccess(env, partnerKey, email, url.pathname);
    return next();
  }

  // ── 6. Invite check ────────────────────────────────────────────────
  if (partnerKey && env.KV) {
    const inviteRaw = await env.KV.get(`partner_invite:${partnerKey}:${email}`);
    if (inviteRaw) {
      try {
        const invite = JSON.parse(inviteRaw);
        if (invite.active === true) {
          await logAccess(env, partnerKey, email, url.pathname);
          return next();
        }
      } catch { /* malformed invite */ }
    }
  }

  // ── 7. Deny ────────────────────────────────────────────────────────
  return redirectDeny(partnerKey);
}
