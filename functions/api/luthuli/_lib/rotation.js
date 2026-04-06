// Luthuli Lodge — Staff rotation logic (21-on / 7-off cycle)

/**
 * Calculate rotation status for a given date based on a rotation start date.
 * Cycle: 21 days on, 7 days off (28-day cycle).
 */
export function getRotationStatus(rotationStart, dateStr) {
  const start = new Date(rotationStart + 'T00:00:00Z');
  const date = new Date(dateStr + 'T00:00:00Z');
  const diffMs = date.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Handle dates before rotation start — assume they wrap cyclically
  const cycleDay = ((diffDays % 28) + 28) % 28;

  return cycleDay < 21 ? 'work' : 'off';
}

/**
 * Check if a date string is a Sunday.
 */
export function isSunday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.getUTCDay() === 0;
}

/**
 * Check if there are guests in camp on a given date.
 */
export async function hasGuestsOnDate(db, dateStr) {
  const { results } = await db.prepare(
    `SELECT COUNT(*) as c FROM bookings
     WHERE arrive <= ? AND depart > ? AND status IN ('Confirmed', 'Checked In')`
  ).bind(dateStr, dateStr).all();
  return results[0].c > 0;
}

/**
 * Get a staff member's effective status for a single date.
 * Combines rotation cycle, overrides, approved leave, and Sunday guest checks.
 *
 * Returns: { status: 'work'|'off'|'sunday_off'|'sunday_work'|'leave'|'override_on'|'override_off', override?: object }
 */
export async function getStaffDayStatus(db, staffId, rotationStart, dateStr) {
  // Check for approved leave first
  const leave = await db.prepare(
    `SELECT * FROM staff_leave_requests
     WHERE staff_id = ? AND start_date <= ? AND end_date >= ? AND status = 'Approved'
     LIMIT 1`
  ).bind(staffId, dateStr, dateStr).first();

  if (leave) {
    return { status: 'leave', detail: leave.reason || 'Approved leave' };
  }

  // Check for manual override
  const override = await db.prepare(
    `SELECT * FROM staff_overrides WHERE staff_id = ? AND date = ? LIMIT 1`
  ).bind(staffId, dateStr).first();

  if (override) {
    return {
      status: override.status === 'on' ? 'override_on' : 'override_off',
      override,
    };
  }

  // Calculate rotation
  const rotation = getRotationStatus(rotationStart, dateStr);

  // If it's a work day and a Sunday, check guests
  if (rotation === 'work' && isSunday(dateStr)) {
    const guests = await hasGuestsOnDate(db, dateStr);
    if (!guests) {
      return { status: 'sunday_off', detail: 'Sunday — no guests in camp' };
    }
    return { status: 'sunday_work', detail: 'Sunday — guests in camp, working' };
  }

  return { status: rotation };
}

/**
 * Get full schedule for a staff member across a date range.
 * Returns array of { date, status, detail?, override? }
 */
export async function getScheduleRange(db, staffId, rotationStart, startDate, endDate) {
  const schedule = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayStatus = await getStaffDayStatus(db, staffId, rotationStart, dateStr);
    schedule.push({ date: dateStr, ...dayStatus });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return schedule;
}
