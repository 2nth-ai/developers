// GET /api/auth/session — check OTP session, GitHub session, or SSO JWT

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function validateSSOToken(cookieHeader, jwtSecret) {
  if (!jwtSecret) return null;
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
  const cookie = request.headers.get('Cookie') || '';

  // 1. OTP session (sid cookie → KV)
  if (env.KV) {
    const sidMatch = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
    if (sidMatch) {
      const raw = await env.KV.get(`session:${sidMatch[1]}`);
      if (raw) {
        try {
          const user = JSON.parse(raw);
          return Response.json({ user });
        } catch {}
      }
    }
  }

  // 2. GitHub OAuth session (dev_session cookie)
  const ghMatch = cookie.match(/(?:^|;\s*)dev_session=([^;]+)/);
  if (ghMatch) {
    try {
      const profile = JSON.parse(atob(ghMatch[1]));
      if (profile.login) {
        return Response.json({
          user: {
            id: String(profile.id),
            email: profile.login + '@github',
            name: profile.name || profile.login,
            avatar: profile.avatar,
            role: 'developer',
            tier: 'github',
          }
        });
      }
    } catch {}
  }

  // 3. SSO JWT (2nth_session cookie)
  const payload = await validateSSOToken(cookie, env.JWT_SECRET);
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
