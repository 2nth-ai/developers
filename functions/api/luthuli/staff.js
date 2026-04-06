// GET /api/luthuli/staff
import { initDB } from './_lib/db.js';
import { getScheduleRange } from './_lib/rotation.js';

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
  const month = url.searchParams.get('month');

  let start, end;
  if (month) {
    const [y, m] = month.split('-').map(Number);
    start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    // Default: current month
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  // Get all active staff
  const { results: allStaff } = await db.prepare(
    `SELECT * FROM staff WHERE active = 1 ORDER BY name`
  ).all();

  // Get leave requests for the period
  const { results: leaveRequests } = await db.prepare(
    `SELECT * FROM staff_leave_requests WHERE start_date <= ? AND end_date >= ? ORDER BY start_date`
  ).bind(end, start).all();

  // Build schedule for each staff member
  const staffSchedules = [];
  for (const s of allStaff) {
    const schedule = await getScheduleRange(db, s.id, s.rotation_start, start, end);

    const workDays = schedule.filter(d => d.status === 'work' || d.status === 'sunday_work' || d.status === 'override_on').length;
    const offDays = schedule.filter(d => d.status === 'off' || d.status === 'sunday_off' || d.status === 'override_off' || d.status === 'leave').length;

    const staffLeave = leaveRequests.filter(lr => lr.staff_id === s.id);

    staffSchedules.push({
      ...s,
      schedule,
      summary: { workDays, offDays, totalDays: schedule.length },
      leaveRequests: staffLeave,
    });
  }

  return new Response(JSON.stringify({ staff: staffSchedules }), { status: 200, headers: CORS });
}
