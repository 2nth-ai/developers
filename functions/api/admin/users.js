// /api/admin/users — CRUD for partner users in KV
// GET: list all users | POST: create/update | DELETE: deactivate
import { verifyJWT, extractToken } from '../../lib/jwt.js';

async function requireAdmin(request, env) {
  const tokenInfo = extractToken(request);
  if (!tokenInfo) return null;

  if (tokenInfo.type === 'jwt' && env.JWT_SECRET) {
    const payload = await verifyJWT(tokenInfo.token, env.JWT_SECRET);
    if (payload && (payload.scope === 'full' || payload.role === 'admin')) return payload;
  }

  // Legacy fallback
  if (tokenInfo.type === 'legacy') {
    try {
      const session = JSON.parse(atob(tokenInfo.token));
      if (session.scope === 'full' || session.fullAccess) return session;
    } catch {}
  }
  return null;
}

// GET /api/admin/users — list all users from KV
export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  if (!env.SESSIONS) {
    return Response.json({ error: 'KV not configured', users: [] });
  }

  const list = await env.SESSIONS.list({ prefix: 'user:', limit: 100 });
  const users = [];

  for (const key of list.keys) {
    // Skip reverse lookup keys
    if (key.name.startsWith('user-email:')) continue;
    const data = await env.SESSIONS.get(key.name, 'json');
    if (data) users.push(data);
  }

  // Sort by name
  users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return Response.json({ users, count: users.length, source: 'kv' });
}

// POST /api/admin/users — create or update a user
export async function onRequestPost(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  if (!env.SESSIONS) {
    return Response.json({ error: 'KV not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, email, name, scope, pin } = body;
  if (!id || !email || !name || !pin) {
    return Response.json({ error: 'id, email, name, and pin are required' }, { status: 400 });
  }

  // Check if user already exists
  const existing = await env.SESSIONS.get(`user:${id}`, 'json');

  const user = {
    id,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    scope: scope || 'full',
    pin: String(pin).trim(),
    active: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Write user record
  await env.SESSIONS.put(`user:${id}`, JSON.stringify(user));
  // Write email reverse lookup
  await env.SESSIONS.put(`user-email:${user.email}`, id);

  return Response.json({
    success: true,
    user,
    action: existing ? 'updated' : 'created',
  });
}

// DELETE /api/admin/users?id=xxx — deactivate a user
export async function onRequestDelete(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  if (!env.SESSIONS) {
    return Response.json({ error: 'KV not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const existing = await env.SESSIONS.get(`user:${id}`, 'json');
  if (!existing) return Response.json({ error: 'User not found' }, { status: 404 });

  // Soft delete
  existing.active = false;
  existing.updatedAt = new Date().toISOString();
  await env.SESSIONS.put(`user:${id}`, JSON.stringify(existing));

  return Response.json({ success: true, action: 'deactivated', id });
}
