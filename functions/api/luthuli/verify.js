// POST /api/luthuli/verify
import { initDB, generateId } from './_lib/db.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.LUTHULI_DB;
  await initDB(db);

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  const { identifier, code, channel } = body;

  if (!identifier || !code) {
    return new Response(
      JSON.stringify({ error: 'identifier and code are required' }),
      { status: 400, headers: CORS }
    );
  }

  // Look up OTP
  const otp = await db.prepare(
    `SELECT * FROM otp_codes
     WHERE identifier = ? AND code = ? AND verified = 0 AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`
  ).bind(identifier, code).first();

  if (!otp) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired code' }),
      { status: 401, headers: CORS }
    );
  }

  // Mark as verified
  await db.prepare(
    `UPDATE otp_codes SET verified = 1 WHERE id = ?`
  ).bind(otp.id).run();

  // Resolve user identity
  let user = { name: identifier, role: channel || 'guest', id: null };

  // Check guests
  const guest = await db.prepare(
    `SELECT * FROM guests WHERE email = ? OR phone = ? OR name LIKE ? LIMIT 1`
  ).bind(identifier, identifier, `%${identifier}%`).first();

  if (guest) {
    user = { id: guest.id, name: guest.name, role: guest.source === 'Owner' ? 'owner' : 'guest', email: guest.email };
  }

  // Check staff
  const staff = await db.prepare(
    `SELECT * FROM staff WHERE email = ? OR phone = ? OR name LIKE ? LIMIT 1`
  ).bind(identifier, identifier, `%${identifier}%`).first();

  if (staff) {
    user = { id: staff.id, name: staff.name, role: 'staff', email: staff.email };
  }

  // Check managers (auto-enrolled admins)
  const manager = await db.prepare(
    `SELECT * FROM managers WHERE email = ? OR name LIKE ? LIMIT 1`
  ).bind(identifier, `%${identifier}%`).first();

  if (manager) {
    user = { id: manager.id, name: manager.name, role: 'admin', email: manager.email };
  }

  // If channel is manager and not already admin, elevate role
  if (channel === 'manager' && user.role !== 'admin') {
    user.role = 'manager';
  }

  // Create simple JWT (base64 encoded JSON — demo mode)
  const payload = {
    sub: user.id || identifier,
    name: user.name,
    channel: channel || 'guest',
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  };

  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body64 = btoa(JSON.stringify(payload));
  const token = `${header}.${body64}.demo`;

  // Log
  await db.prepare(
    `INSERT INTO system_log (id, event, actor, channel, target_type, target_id, detail, created_at)
     VALUES (?, 'auth_verified', ?, ?, 'user', ?, ?, datetime('now'))`
  ).bind(generateId(), identifier, channel || 'guest', user.id || identifier, `Verified as ${user.name} (${user.role})`).run();

  // Set session cookie
  const headers = new Headers(CORS);
  headers.set('Set-Cookie', `luthuli_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);

  return new Response(JSON.stringify({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    token,
  }), { status: 200, headers });
}
