// POST /api/luthuli/reset — Reset and reseed the database for testing
// GET /api/luthuli/reset — Show current data counts
import { initDB, generateId } from './_lib/db.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// GET — show counts
export async function onRequestGet(context) {
  const db = context.env.LUTHULI_DB;
  await initDB(db);

  const tables = ['guests', 'bookings', 'staff', 'managers', 'staff_overrides', 'staff_leave_requests', 'chat_messages', 'otp_codes', 'system_log'];
  const counts = {};

  for (const t of tables) {
    try {
      const r = await db.prepare(`SELECT COUNT(*) as c FROM ${t}`).first();
      counts[t] = r.c;
    } catch (e) {
      counts[t] = 'error: ' + e.message;
    }
  }

  return new Response(JSON.stringify({
    status: 'ok',
    database: 'luthuli-lodge',
    counts,
    hint: 'POST to this endpoint to reset and reseed the database',
  }), { headers: CORS });
}

// POST — reset and reseed
export async function onRequestPost(context) {
  const db = context.env.LUTHULI_DB;

  let body = {};
  try { body = await context.request.json(); } catch {}

  const action = body.action || 'reset'; // reset | clear | seed

  if (action === 'clear') {
    // Clear all data but keep schema
    const tables = ['system_log', 'chat_messages', 'otp_codes', 'staff_leave_requests', 'staff_overrides', 'bookings', 'guests', 'staff', 'managers'];
    for (const t of tables) {
      try { await db.prepare(`DELETE FROM ${t}`).run(); } catch {}
    }
    return new Response(JSON.stringify({ status: 'cleared', message: 'All data cleared' }), { headers: CORS });
  }

  if (action === 'seed' || action === 'reset') {
    if (action === 'reset') {
      // Drop and recreate everything
      const tables = ['system_log', 'chat_messages', 'otp_codes', 'staff_leave_requests', 'staff_overrides', 'bookings', 'guests', 'staff', 'managers'];
      for (const t of tables) {
        try { await db.prepare(`DROP TABLE IF EXISTS ${t}`).run(); } catch {}
      }
    }

    // Reinitialize schema + seed
    // Force re-init by resetting the module state
    await initDB(db);

    // Force seed even if tables existed
    const seeds = [
      // Guests
      `INSERT OR REPLACE INTO guests (id, name, email, phone, source) VALUES ('g_hamlin', 'Hamlin Family', 'guy@rumf.co.za', '+27820000001', 'Owner')`,
      `INSERT OR REPLACE INTO guests (id, name, email, phone, source) VALUES ('g_vdmerwe', 'Van der Merwe', 'vdmerwe@example.com', '+27820000002', 'Direct')`,
      `INSERT OR REPLACE INTO guests (id, name, email, phone, source) VALUES ('g_ndlovu', 'Ndlovu & Party', 'ndlovu@example.com', '+27820000003', 'Perfect Hideaways')`,
      `INSERT OR REPLACE INTO guests (id, name, email, phone, source) VALUES ('g_thompson', 'Thompson', 'thompson@example.com', '+27820000004', 'Direct')`,
      `INSERT OR REPLACE INTO guests (id, name, email, phone, source) VALUES ('g_birding', 'Birding SA Group', 'info@birdingsa.co.za', '+27820000005', 'Direct')`,

      // Bookings
      `INSERT OR REPLACE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_hamlin', 'g_hamlin', 'Owner', '2026-04-02', '2026-04-08', 2, 2, 'Host Family', 'No guide', 0, 'Confirmed', 'Owner stay')`,
      `INSERT OR REPLACE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_vdmerwe', 'g_vdmerwe', 'Direct', '2026-04-06', '2026-04-10', 2, 0, 'Guest Pavilion', 'Thabo', 2800, 'Confirmed', NULL)`,
      `INSERT OR REPLACE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_ndlovu', 'g_ndlovu', 'Perfect Hideaways', '2026-04-12', '2026-04-15', 4, 2, 'Full Lodge', 'Sipho', 4200, 'Confirmed', 'PH ref: PH-2026-0412')`,
      `INSERT OR REPLACE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_thompson', 'g_thompson', 'Direct', '2026-04-18', '2026-04-21', 2, 0, 'Guest Pavilion', 'Sipho', 2800, 'Pending', 'Awaiting deposit')`,
      `INSERT OR REPLACE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_birding', 'g_birding', 'Direct', '2026-04-25', '2026-04-28', 8, 0, 'Full Lodge', 'Thabo', 6500, 'Confirmed', 'Birding group — 8 pax')`,

      // Staff
      `INSERT OR REPLACE INTO staff (id, name, role, email, phone, rotation_start, annual_leave_days, active) VALUES ('s_nomsa', 'Nomsa', 'housekeeper', 'nomsa@luthuli.test', '+27830000001', '2026-03-01', 15, 1)`,
      `INSERT OR REPLACE INTO staff (id, name, role, email, phone, rotation_start, annual_leave_days, active) VALUES ('s_thandiwe', 'Thandiwe', 'housekeeper', 'thandiwe@luthuli.test', '+27830000002', '2026-03-22', 15, 1)`,

      // Managers
      `INSERT OR REPLACE INTO managers (id, name, email, role) VALUES ('m_craig', 'Craig Leppan', 'craig@b2bs.co.za', 'admin')`,
      `INSERT OR REPLACE INTO managers (id, name, email, role) VALUES ('m_guy', 'Guy Hamlin', 'guy@rumf.co.za', 'admin')`,

      // Log the reset
      `INSERT INTO system_log (id, event, actor, channel, detail, created_at) VALUES ('${generateId()}', 'database_reset', 'admin', 'system', 'Database reset and reseeded', datetime('now'))`,
    ];

    for (const sql of seeds) {
      try { await db.prepare(sql).run(); } catch (e) { console.error(sql, e); }
    }

    // Get counts after seed
    const counts = {};
    for (const t of ['guests', 'bookings', 'staff', 'managers']) {
      const r = await db.prepare(`SELECT COUNT(*) as c FROM ${t}`).first();
      counts[t] = r.c;
    }

    return new Response(JSON.stringify({
      status: action === 'reset' ? 'reset_complete' : 'seeded',
      message: 'Database ' + (action === 'reset' ? 'reset and reseeded' : 'seeded'),
      counts,
    }), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: 'Unknown action. Use: reset, clear, or seed' }), { status: 400, headers: CORS });
}
