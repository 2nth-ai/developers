// ═══════════════════════════════════════════════════════════════════
// functions/lib/session.js — shared session resolution
//
// Single source of truth for reading who is making a request.
// Import resolveSession() in every middleware and API handler —
// never duplicate parseCookie or KV lookup logic elsewhere.
// ═══════════════════════════════════════════════════════════════════

function parseCookie(header, name) {
  const m = (header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

/**
 * Resolves who is making the request.
 * Priority: sid cookie (KV OTP session) → 2nth_session JWT
 *
 * @returns {{ email: string|null, role: string|null, source: 'sid'|'jwt'|null }}
 */
export async function resolveSession(request, env) {
  const cookies = request.headers.get('Cookie') || '';

  // 1. OTP session — sid cookie → KV lookup
  const sid = parseCookie(cookies, 'sid');
  if (sid && env.KV) {
    try {
      const raw = await env.KV.get(`session:${sid}`);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.email) {
          return { email: s.email.toLowerCase(), role: s.role || null, source: 'sid' };
        }
      }
    } catch { /* ignore */ }
  }

  // 2. SSO JWT — 2nth_session cookie (HMAC-SHA256 signed)
  const jwt = parseCookie(cookies, '2nth_session');
  if (jwt && env.JWT_SECRET) {
    try {
      const [h, p, s] = jwt.split('.');
      if (h && p && s) {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(env.JWT_SECRET),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        const valid = await crypto.subtle.verify(
          'HMAC', key, b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`)
        );
        if (valid) {
          const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
          if (payload.sub && payload.exp > Math.floor(Date.now() / 1000)) {
            return {
              email: payload.email?.toLowerCase() || null,
              role: payload.role || null,
              source: 'jwt',
            };
          }
        }
      }
    } catch { /* ignore */ }
  }

  return { email: null, role: null, source: null };
}

const SESSION_DAYS = 30;

/**
 * Returns the Set-Cookie header value for the sid session cookie.
 * This is the single definition of the cookie format — always Secure.
 */
export function sidCookieHeader(sid, maxAgeDays = SESSION_DAYS) {
  return `sid=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeDays * 86400}`;
}
