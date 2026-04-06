// GET/POST /api/luthuli/bookings
import { initDB, generateId, getBookingsForRange } from './_lib/db.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.LUTHULI_DB;
  await initDB(db);

  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  const status = url.searchParams.get('status');

  let start, end;
  if (month) {
    const [y, m] = month.split('-').map(Number);
    start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    // Default: next 90 days
    const today = new Date();
    start = today.toISOString().slice(0, 10);
    const future = new Date(Date.now() + 90 * 86400000);
    end = future.toISOString().slice(0, 10);
  }

  let bookings = await getBookingsForRange(db, start, end);

  if (status) {
    bookings = bookings.filter(b => b.status === status);
  }

  // Add computed fields
  const enriched = bookings.map(b => {
    const arrive = new Date(b.arrive + 'T00:00:00Z');
    const depart = new Date(b.depart + 'T00:00:00Z');
    const nights = Math.round((depart - arrive) / (1000 * 60 * 60 * 24));
    const guests = (b.adults || 0) + (b.children || 0);
    const effectiveRate = b.base_rate || 0;
    const roomTotal = effectiveRate * nights;
    const levy = 180 * guests * nights;
    const phCommission = b.source === 'Perfect Hideaways' ? roomTotal * 0.2 : 0;

    return {
      ...b,
      nights,
      guests,
      effectiveRate,
      roomTotal,
      levy,
      phCommission,
      total: roomTotal + levy,
    };
  });

  return new Response(JSON.stringify({ bookings: enriched }), { status: 200, headers: CORS });
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

  const { guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes } = body;

  if (!guest_id || !arrive || !depart) {
    return new Response(JSON.stringify({ error: 'guest_id, arrive, and depart are required' }), { status: 400, headers: CORS });
  }

  // Verify guest exists
  const guest = await db.prepare(`SELECT * FROM guests WHERE id = ?`).bind(guest_id).first();
  if (!guest) {
    return new Response(JSON.stringify({ error: 'Guest not found' }), { status: 404, headers: CORS });
  }

  const id = generateId();
  await db.prepare(
    `INSERT INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    guest_id,
    source || 'Direct',
    arrive,
    depart,
    adults || 2,
    children || 0,
    pavilion || null,
    guide || null,
    base_rate || 0,
    status || 'Pending',
    notes || null
  ).run();

  // Log creation
  await db.prepare(
    `INSERT INTO system_log (id, event, actor, channel, target_type, target_id, detail, created_at)
     VALUES (?, 'booking_created', 'api', 'system', 'booking', ?, ?, datetime('now'))`
  ).bind(generateId(), id, `${guest.name} - ${arrive} to ${depart}`).run();

  // Fetch and return the created booking
  const booking = await db.prepare(
    `SELECT b.*, g.name as guest_name, g.email as guest_email
     FROM bookings b JOIN guests g ON b.guest_id = g.id WHERE b.id = ?`
  ).bind(id).first();

  return new Response(JSON.stringify({ success: true, booking }), { status: 201, headers: CORS });
}
