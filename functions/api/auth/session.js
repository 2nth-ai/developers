// GET /api/auth/session — return current user from session

import { resolveSession } from '../../lib/session.js';
import { isAdmin, isPartner } from '../../lib/registry.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { email, role, source } = await resolveSession(request, env);

  if (!email) return Response.json({ user: null }, { status: 401 });

  // If session came from KV, return the full stored object (has name, tier, etc.)
  if (source === 'sid') {
    const cookies = request.headers.get('Cookie') || '';
    const sidMatch = cookies.match(/(?:^|;\s*)sid=([^;]+)/);
    if (sidMatch && env.KV) {
      try {
        const raw = await env.KV.get(`session:${sidMatch[1]}`);
        if (raw) {
          const s = JSON.parse(raw);
          return Response.json({
            user: {
              ...s,
              email: s.email.toLowerCase(),
              isAdmin: isAdmin(s.email, s.role),
              isPartner: isPartner(s.email),
            }
          });
        }
      } catch { /* fall through */ }
    }
  }

  return Response.json({
    user: {
      email,
      name: email.split('@')[0],
      role,
      isAdmin: isAdmin(email, role),
      isPartner: isPartner(email),
    }
  });
}
