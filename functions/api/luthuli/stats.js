// GET /api/luthuli/stats
import { initDB, getBookingsForRange } from './_lib/db.js';
import { getRotationStatus, hasGuestsOnDate } from './_lib/rotation.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  const month = url.searchParams.get('month') || currentMonth();

  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const bookings = await getBookingsForRange(db, start, end);
  const confirmed = bookings.filter(b => b.status !== 'Cancelled');

  // Occupancy
  const totalSlots = 3 * lastDay; // 3 pavilions x days in month
  let bookedNights = 0;
  let guestNights = 0;
  let roomRevenue = 0;
  let levyTotal = 0;
  let phCommission = 0;

  for (const b of confirmed) {
    const bStart = b.arrive < start ? start : b.arrive;
    const bEnd = b.depart > end ? end : b.depart;
    const bStartDate = new Date(bStart + 'T00:00:00Z');
    const bEndDate = new Date(bEnd + 'T00:00:00Z');
    const n = Math.round((bEndDate - bStartDate) / (1000 * 60 * 60 * 24));
    const guests = (b.adults || 0) + (b.children || 0);

    bookedNights += n;
    guestNights += guests * n;
    roomRevenue += (b.base_rate || 0) * n;
    levyTotal += 180 * guests * n;

    if (b.source === 'Perfect Hideaways') {
      phCommission += (b.base_rate || 0) * n * 0.2;
    }
  }

  const occupancyPct = totalSlots > 0 ? Math.round((bookedNights / totalSlots) * 100) : 0;
  const netRevenue = roomRevenue - phCommission;

  // Staff on duty today
  const today = new Date().toISOString().slice(0, 10);
  const { results: allStaff } = await db.prepare(
    `SELECT * FROM staff WHERE active = 1`
  ).all();

  let staffOnDutyToday = 0;
  for (const s of allStaff) {
    const status = getRotationStatus(s.rotation_start, today);
    if (status === 'work') staffOnDutyToday++;
  }

  // Upcoming check-ins (next 7 days)
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const upcomingBookings = await getBookingsForRange(db, today, nextWeek);
  const upcomingCheckins = upcomingBookings.filter(b => b.arrive >= today && b.arrive <= nextWeek && b.status !== 'Cancelled');

  return new Response(JSON.stringify({
    month,
    occupancy_pct: occupancyPct,
    guest_nights: guestNights,
    room_revenue: roomRevenue,
    levy_total: levyTotal,
    ph_commission: phCommission,
    net_revenue: netRevenue,
    bookings_count: confirmed.length,
    staff_on_duty_today: staffOnDutyToday,
    upcoming_checkins: upcomingCheckins.length,
    detail: {
      booked_pavilion_nights: bookedNights,
      total_pavilion_nights: totalSlots,
      bookings: confirmed.map(b => ({
        id: b.id,
        guest: b.guest_name,
        arrive: b.arrive,
        depart: b.depart,
        source: b.source,
        pavilion: b.pavilion,
        status: b.status,
      })),
    },
  }), { status: 200, headers: CORS });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
