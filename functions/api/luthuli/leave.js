// POST /api/luthuli/leave
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

  const { action } = body;

  if (action === 'request') {
    return handleRequest(db, body);
  } else if (action === 'approve' || action === 'deny') {
    return handleDecision(db, body);
  } else {
    return new Response(
      JSON.stringify({ error: 'action must be "request", "approve", or "deny"' }),
      { status: 400, headers: CORS }
    );
  }
}

async function handleRequest(db, body) {
  const { staff_id, start_date, end_date, reason } = body;

  if (!staff_id || !start_date || !end_date) {
    return new Response(
      JSON.stringify({ error: 'staff_id, start_date, and end_date are required' }),
      { status: 400, headers: CORS }
    );
  }

  // Verify staff exists
  const staff = await db.prepare(`SELECT * FROM staff WHERE id = ?`).bind(staff_id).first();
  if (!staff) {
    return new Response(JSON.stringify({ error: 'Staff member not found' }), { status: 404, headers: CORS });
  }

  // Calculate days
  const s = new Date(start_date + 'T00:00:00Z');
  const e = new Date(end_date + 'T00:00:00Z');
  const days = Math.round((e - s) / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return new Response(
      JSON.stringify({ error: 'end_date must be after start_date' }),
      { status: 400, headers: CORS }
    );
  }

  // Check remaining leave
  const { results: usedLeave } = await db.prepare(
    `SELECT COALESCE(SUM(days), 0) as used FROM staff_leave_requests
     WHERE staff_id = ? AND status = 'Approved'`
  ).bind(staff_id).all();

  const used = usedLeave[0].used;
  const remaining = staff.annual_leave_days - used;

  if (days > remaining) {
    return new Response(
      JSON.stringify({ error: `Only ${remaining} leave days remaining (requesting ${days})` }),
      { status: 400, headers: CORS }
    );
  }

  const id = generateId();
  await db.prepare(
    `INSERT INTO staff_leave_requests (id, staff_id, start_date, end_date, days, status, reason, created_at)
     VALUES (?, ?, ?, ?, ?, 'Pending', ?, datetime('now'))`
  ).bind(id, staff_id, start_date, end_date, days, reason || null).run();

  // Log
  await db.prepare(
    `INSERT INTO system_log (id, event, actor, channel, target_type, target_id, detail, created_at)
     VALUES (?, 'leave_requested', ?, 'staff', 'leave_request', ?, ?, datetime('now'))`
  ).bind(generateId(), staff_id, id, `${start_date} to ${end_date} (${days} days)`).run();

  return new Response(JSON.stringify({
    success: true,
    request: { id, staff_id, staff_name: staff.name, start_date, end_date, days, status: 'Pending', reason },
    remaining_after: remaining - days,
  }), { status: 201, headers: CORS });
}

async function handleDecision(db, body) {
  const { action, request_id, decided_by } = body;

  if (!request_id) {
    return new Response(
      JSON.stringify({ error: 'request_id is required' }),
      { status: 400, headers: CORS }
    );
  }

  const leaveReq = await db.prepare(
    `SELECT lr.*, s.name as staff_name FROM staff_leave_requests lr
     JOIN staff s ON lr.staff_id = s.id WHERE lr.id = ?`
  ).bind(request_id).first();

  if (!leaveReq) {
    return new Response(JSON.stringify({ error: 'Leave request not found' }), { status: 404, headers: CORS });
  }

  if (leaveReq.status !== 'Pending') {
    return new Response(
      JSON.stringify({ error: `Request already ${leaveReq.status}` }),
      { status: 400, headers: CORS }
    );
  }

  const newStatus = action === 'approve' ? 'Approved' : 'Denied';

  await db.prepare(
    `UPDATE staff_leave_requests SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?`
  ).bind(newStatus, decided_by || 'manager', request_id).run();

  // Log
  await db.prepare(
    `INSERT INTO system_log (id, event, actor, channel, target_type, target_id, detail, created_at)
     VALUES (?, ?, ?, 'manager', 'leave_request', ?, ?, datetime('now'))`
  ).bind(generateId(), `leave_${action}d`, decided_by || 'manager', request_id, `${leaveReq.staff_name}: ${leaveReq.start_date} to ${leaveReq.end_date}`).run();

  return new Response(JSON.stringify({
    success: true,
    request: { ...leaveReq, status: newStatus, decided_by: decided_by || 'manager' },
  }), { status: 200, headers: CORS });
}
