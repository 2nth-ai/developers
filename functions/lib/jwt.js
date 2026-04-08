// Shared JWT sign/verify for 2nth.ai platform auth
// Ported from 2nth-site/src/auth.ts — HMAC-SHA256

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function getKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export function generateJTI() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const sigInput = `${headerB64}.${payloadB64}`;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sigInput));
  return `${sigInput}.${base64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const enc = new TextEncoder();
    const key = await getKey(secret);
    const sigInput = `${headerB64}.${payloadB64}`;
    const valid = await crypto.subtle.verify('HMAC', key, base64urlDecode(sigB64), enc.encode(sigInput));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractToken(request) {
  // Check 2nth_session cookie first, then dev_access fallback, then Authorization header
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/2nth_session=([^\s;]+)/);
  if (match) return { token: match[1], type: 'jwt' };
  const legacy = cookie.match(/dev_access=([^\s;]+)/);
  if (legacy) return { token: legacy[1], type: 'legacy' };
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return { token: auth.slice(7), type: 'jwt' };
  return null;
}

export async function createSession(env, user) {
  const jti = generateJTI();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    scope: user.scope || 'full',
    role: user.scope === 'full' ? 'admin' : 'user',
    iat: now,
    exp: now + SESSION_TTL,
    jti: jti,
    iss: '2nth.ai',
  };

  // Store session in KV for revocation support
  if (env.SESSIONS) {
    await env.SESSIONS.put(`session:${jti}`, JSON.stringify({
      userId: user.id,
      email: user.email,
      scope: user.scope,
      role: payload.role,
      issuedAt: new Date().toISOString(),
    }), { expirationTtl: SESSION_TTL });
  }

  const token = await signJWT(payload, env.JWT_SECRET);
  return token;
}

export function setSessionCookie(token) {
  return `2nth_session=${token}; Domain=.2nth.ai; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

// For non-.2nth.ai domains (pages.dev dev URLs), set without Domain
export function setSessionCookieLocal(token) {
  return `2nth_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

export const ADMIN_DOMAINS = ['2nth.ai', '2nth.io', 'b2bs.co.za'];

export function isAdminEmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  return ADMIN_DOMAINS.includes(domain);
}
