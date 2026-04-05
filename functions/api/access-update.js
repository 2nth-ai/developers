// POST /api/access-update — admin updates a user's scope
// Body: { userId: 'paul', scope: 'presbury' }
// Only accessible to full-scope users

export async function onRequestPost(context) {
  const { request, env } = context;

  // Check admin session
  const session = getSession(request);
  if (!session || (session.scope !== 'full' && !session.fullAccess)) {
    return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json();
  const { userId, scope } = body;
  if (!userId || scope === undefined) {
    return new Response(JSON.stringify({ error: 'userId and scope required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Update in KV if available
  if (env.SESSIONS) {
    try {
      const userData = await env.SESSIONS.get(`user:${userId}`, 'json');
      if (userData) {
        userData.scope = scope;
        userData.updated_at = new Date().toISOString();
        userData.updated_by = session.email;
        await env.SESSIONS.put(`user:${userId}`, JSON.stringify(userData));
      }
    } catch {}
  }

  return new Response(JSON.stringify({
    ok: true,
    userId,
    scope,
    message: `Scope updated for ${userId}: ${scope}`,
    note: 'User must sign out and back in for changes to take effect.',
  }), { headers: { 'Content-Type': 'application/json' } });
}

function getSession(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/dev_access=([^\s;]+)/);
  if (!match) return null;
  try {
    const session = JSON.parse(atob(match[1]));
    if (session.email && session.approved) return session;
  } catch {}
  return null;
}
