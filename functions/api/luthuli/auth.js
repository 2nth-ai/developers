// POST /api/luthuli/auth
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

  const { identifier, channel } = body;

  if (!identifier) {
    return new Response(JSON.stringify({ error: 'identifier is required (phone, email, or name)' }), { status: 400, headers: CORS });
  }

  // Generate 6-digit OTP
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const id = generateId();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Store OTP
  await db.prepare(
    `INSERT INTO otp_codes (id, identifier, code, channel, verified, expires_at, created_at)
     VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`
  ).bind(id, identifier, code, channel || 'guest', expiresAt).run();

  // Try to find an email for the user
  let recipientEmail = null;
  if (identifier.includes('@')) {
    recipientEmail = identifier;
  } else {
    // Look up by phone or name
    const guest = await db.prepare(
      `SELECT email FROM guests WHERE phone = ? OR name LIKE ? LIMIT 1`
    ).bind(identifier, `%${identifier}%`).first();
    if (guest?.email) recipientEmail = guest.email;

    const staff = await db.prepare(
      `SELECT email FROM staff WHERE phone = ? OR name LIKE ? LIMIT 1`
    ).bind(identifier, `%${identifier}%`).first();
    if (staff?.email) recipientEmail = staff.email;

    const manager = await db.prepare(
      `SELECT email FROM managers WHERE email = ? OR name LIKE ? LIMIT 1`
    ).bind(identifier, `%${identifier}%`).first();
    if (manager?.email) recipientEmail = manager.email;
  }

  // Send OTP via Resend
  const resendKey = env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const toEmail = recipientEmail || 'hello@2nth.ai';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Luthuli Lodge <hello@2nth.ai>',
          to: [toEmail],
          subject: `Your Luthuli Lodge verification code: ${code}`,
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2d5016;">Luthuli Lodge</h2>
              <p>Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; background: #f5f5f0; text-align: center; border-radius: 8px; margin: 16px 0;">
                ${code}
              </div>
              <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error('Resend error:', e);
    }
  }

  // Log
  await db.prepare(
    `INSERT INTO system_log (id, event, actor, channel, target_type, target_id, detail, created_at)
     VALUES (?, 'otp_sent', ?, ?, 'otp', ?, ?, datetime('now'))`
  ).bind(generateId(), identifier, channel || 'guest', id, `Code sent to ${recipientEmail || 'hello@2nth.ai'}`).run();

  const response = {
    success: true,
    message: 'Verification code sent',
    expires_in: '10 minutes',
  };

  // Include demo_code for development/demo
  response.demo_code = code;

  return new Response(JSON.stringify(response), { status: 200, headers: CORS });
}
