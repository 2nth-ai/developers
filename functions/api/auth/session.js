// GET /api/auth/session — validate 2nth_session SSO JWT
// Returns { user } with profile from the JWT, or { user: null }

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function validateSSOToken(cookieHeader, jwtSecret) {
  const match = (cookieHeader || '').match(/2nth_session=([^\s;]+)/);
  if (!match) return null;
  const [h, p, s] = match[1].split('.');
  if (!h || !p || !s) return null;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, b64urlDecode(s), enc.encode(`${h}.${p}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const payload = await validateSSOToken(
    request.headers.get('Cookie'),
    env.JWT_SECRET
  );

  if (!payload) return Response.json({ user: null }, { status: 401 });

  return Response.json({
    user: {
      id:    payload.sub,
      email: payload.email,
      name:  payload.email.split('@')[0],
      role:  payload.role || 'user',
      tier:  payload.tier || 'explorer',
    }
  });
}
