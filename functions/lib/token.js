// ═══════════════════════════════════════════════════════════════════
// functions/lib/token.js — signed partner preview tokens
//
// Token format: base64url(payload).base64url(HMAC-SHA256 signature)
// Payload:      { k: partnerKey, e: email, exp: epochSeconds }
//
// Usage:
//   const t = await generatePreviewToken(key, email, env.JWT_SECRET);
//   const url = `https://developers.2nth.ai/partners/${key}?token=${t}`;
//
//   const claim = await validatePreviewToken(token, env.JWT_SECRET);
//   // claim = { key, email } or null
// ═══════════════════════════════════════════════════════════════════

const TOKEN_EXPIRY_DAYS = 30;
const SESSION_EXPIRY_DAYS = 30;
export const PPS_COOKIE = 'pps'; // partner preview session

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str) {
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export async function generatePreviewToken(partnerKey, email, secret, expiryDays = TOKEN_EXPIRY_DAYS) {
  const payload = JSON.stringify({
    k: partnerKey,
    e: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + expiryDays * 86400,
  });
  const payloadB64 = b64url(new TextEncoder().encode(payload));

  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payloadB64));

  return `${payloadB64}.${b64url(sig)}`;
}

export async function validatePreviewToken(token, secret) {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64     = token.slice(dot + 1);

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', cryptoKey,
      b64urlDecode(sigB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (!payload.k || !payload.e || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired

    return { key: payload.k, email: payload.e };
  } catch {
    return null;
  }
}

/** Generate a random session ID and store it in KV. Returns the ID. */
export async function createPPSession(kv, partnerKey, email) {
  const id = crypto.randomUUID().replace(/-/g, '');
  const exp = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_DAYS * 86400;
  await kv.put(`pps:${id}`, JSON.stringify({ key: partnerKey, email, exp }), {
    expirationTtl: SESSION_EXPIRY_DAYS * 86400,
  });
  return id;
}

/** Validate a PPS cookie value. Returns { key, email } or null. */
export async function validatePPSession(kv, sessionId) {
  if (!sessionId || !kv) return null;
  const raw = await kv.get(`pps:${sessionId}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s.exp < Math.floor(Date.now() / 1000)) return null;
    return { key: s.key, email: s.email };
  } catch {
    return null;
  }
}

/** Build the Set-Cookie header string for a PPS session. */
export function ppsCookieHeader(sessionId, maxAgeDays = SESSION_EXPIRY_DAYS) {
  return `${PPS_COOKIE}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeDays * 86400}; Path=/partners`;
}
