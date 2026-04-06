// Luthuli Lodge — Intent detection and response handlers
import { getBookingsForRange, generateId } from './db.js';
import { getRotationStatus, getScheduleRange, hasGuestsOnDate } from './rotation.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function nights(arrive, depart) {
  const a = new Date(arrive + 'T00:00:00Z');
  const d = new Date(depart + 'T00:00:00Z');
  return Math.round((d - a) / (1000 * 60 * 60 * 24));
}

function fmtDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dt = new Date(d + 'T00:00:00Z');
  return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`;
}

function fmtMoney(n) {
  return 'R' + Number(n).toLocaleString('en-ZA');
}

function monthRange(month) {
  // month = '2026-04'
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Guest Intents ──────────────────────────────────────────────────────────

const guestIntents = [
  {
    id: 'greeting',
    patterns: [/^(hi|hello|hey|good\s*(morning|afternoon|evening))/i],
    handler: async () => ({
      reply: `Welcome to Luthuli Lodge! I'm your booking assistant.\n\nHow can I help?\n- Check availability\n- Pricing & rates\n- Lodge & pavilion info\n- Game drive guides\n- Make a booking\n\nJust ask me anything!`,
    }),
  },
  {
    id: 'check_availability',
    patterns: [/(avail|dates|vacancy|free|open)/i],
    handler: async (db, ctx) => {
      const month = ctx.month || currentMonth();
      const { start, end } = monthRange(month);
      const bookings = await getBookingsForRange(db, start, end);

      if (bookings.length === 0) {
        return { reply: `Great news! The lodge is wide open for ${month}. All pavilions are available. Would you like to make a booking?` };
      }

      const lines = bookings.map(b =>
        `- ${b.pavilion || 'TBD'}: ${fmtDate(b.arrive)}–${fmtDate(b.depart)} (${b.guest_name})`
      );

      // Find open gaps
      const booked = bookings.filter(b => b.status !== 'Cancelled');
      return {
        reply: `Here's the ${month} calendar:\n\n**Booked:**\n${lines.join('\n')}\n\nWould you like me to check specific dates, or shall we start a booking?`,
        metadata: { type: 'availability', data: { month, bookings: booked } },
      };
    },
  },
  {
    id: 'pricing',
    patterns: [/(price|rate|cost|how much|charge)/i],
    handler: async () => ({
      reply: `**Luthuli Lodge Rates:**\n\n- **River Pavilion** — sleeps 4, R2 800/night\n- **Bush Pavilion** — sleeps 2, R2 800/night\n- **Sunset Pavilion** — sleeps 6, R4 200/night\n\n**Extras:**\n- Conservation levy: R180 per person per night\n- Game drive guide: included (Thabo or Sipho)\n- External guide: available on request\n\n**Perfect Hideaways bookings** include a 20% platform commission.\n\nWould you like to check availability or make a booking?`,
    }),
  },
  {
    id: 'conservation_levy',
    patterns: [/(levy|conservation fee)/i],
    handler: async () => ({
      reply: `The **conservation levy** is R180 per person per night. This goes directly to the conservancy and covers:\n- Anti-poaching patrols\n- Wildlife monitoring\n- Habitat restoration\n- Community development\n\nIt's added on top of the nightly pavilion rate. Children are charged the same levy.`,
    }),
  },
  {
    id: 'lodge_info',
    patterns: [/(where|location|direction|about|tell me)/i],
    handler: async () => ({
      reply: `**Luthuli Lodge** is a private bush lodge in the Limpopo province of South Africa.\n\n- **GPS:** -23.7456, 30.1234\n- **Nearest town:** Hoedspruit (45 min drive)\n- **Nearest airport:** Eastgate (HDSM) — 50 min\n\nThe lodge sits on a private conservancy with Big 5 traversing rights. Three exclusive-use pavilions overlook the seasonal river, with game drives twice daily.\n\nWant to know about our pavilions or guides?`,
    }),
  },
  {
    id: 'pavilion_info',
    patterns: [/(room|pavilion|accommodation|sleep)/i],
    handler: async () => ({
      reply: `**Our 3 Pavilions:**\n\n**River Pavilion** — Sleeps 4\nOverlooks the riverbed. Open-plan lounge, plunge pool, outdoor shower. Perfect for families.\n\n**Bush Pavilion** — Sleeps 2\nIntimate and secluded. Elevated deck with bush views. Ideal for couples.\n\n**Sunset Pavilion** — Sleeps 6\nOur largest unit. Wraparound deck, private boma, two en-suite bedrooms + sleeper couch. Great for groups.\n\nAll pavilions include daily housekeeping, minibar, Wi-Fi, and game drives.`,
    }),
  },
  {
    id: 'guide_info',
    patterns: [/(guide|game drive|safari)/i],
    handler: async () => ({
      reply: `**Our Guides:**\n\n- **Thabo** — Head guide. FGASA Level 3, specialist in big cats and tracking. 12 years' experience.\n- **Sipho** — Senior guide. Birding expert, night drive specialist. 8 years' experience.\n- **External** — We can arrange specialist guides (birding groups, photography safaris) on request.\n\nGame drives depart at 05:30 (summer) or 06:00 (winter) and again at 15:30. Each drive is ~3 hours.`,
    }),
  },
  {
    id: 'start_booking',
    patterns: [/(book|reserve|want to stay)/i],
    handler: async (db, ctx) => ({
      reply: `Great, let's get you booked in! I'll need a few details.\n\nFirst — what are your **arrival and departure dates**? (e.g. 15-18 April)`,
      flow: {
        flow: 'booking',
        step: 'ask_dates',
        slots: { arrive: null, depart: null, adults: null, children: null, pavilion: null, guide: null, name: null, email: null },
      },
    }),
  },
  {
    id: 'fallback',
    patterns: [/.*/],
    handler: async () => ({
      reply: `I can help with:\n- **Availability** — check open dates\n- **Bookings** — reserve your stay\n- **Pricing** — rates and fees\n- **Lodge info** — location, pavilions, guides\n\nJust ask!`,
    }),
  },
];

// ─── Staff Intents ──────────────────────────────────────────────────────────

const staffIntents = [
  {
    id: 'my_schedule',
    patterns: [/(schedule|when.*work|next shift|roster)/i],
    handler: async (db, ctx) => {
      const { results: allStaff } = await db.prepare(
        `SELECT * FROM staff WHERE active = 1`
      ).all();

      // Use ctx.staffId or default to first staff member
      const staff = ctx.staffId
        ? allStaff.find(s => s.id === ctx.staffId)
        : allStaff[0];

      if (!staff) return { reply: 'Could not find your staff record.' };

      const today = new Date().toISOString().slice(0, 10);
      const endDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const schedule = await getScheduleRange(db, staff.id, staff.rotation_start, today, endDate);

      const workDays = schedule.filter(d => d.status.includes('work') || d.status === 'override_on');
      const offDays = schedule.filter(d => d.status.includes('off') || d.status === 'leave');

      const lines = schedule.map(d => {
        const icon = d.status.includes('work') || d.status === 'override_on' ? 'ON' : 'OFF';
        return `${fmtDate(d.date)}: ${icon} (${d.status}${d.detail ? ' — ' + d.detail : ''})`;
      });

      return {
        reply: `**${staff.name}'s Schedule** (next 14 days):\n\n${lines.join('\n')}\n\n${workDays.length} work days, ${offDays.length} off days.`,
        metadata: { type: 'schedule', data: schedule },
      };
    },
  },
  {
    id: 'who_covers',
    patterns: [/(who.*cover|who.*on|coverage)/i],
    handler: async (db) => {
      const { results: allStaff } = await db.prepare(
        `SELECT * FROM staff WHERE active = 1`
      ).all();
      const today = new Date().toISOString().slice(0, 10);

      const statuses = [];
      for (const s of allStaff) {
        const rotation = getRotationStatus(s.rotation_start, today);
        statuses.push(`- **${s.name}**: ${rotation.toUpperCase()} today`);
      }

      return { reply: `**Staff Coverage Today (${fmtDate(today)}):**\n\n${statuses.join('\n')}` };
    },
  },
  {
    id: 'guest_checkins',
    patterns: [/(check.?in|arriving|guest.*tomorrow|who.*coming)/i],
    handler: async (db) => {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const bookings = await getBookingsForRange(db, today, nextWeek);

      const arriving = bookings.filter(b => b.arrive >= today && b.arrive <= nextWeek);
      if (arriving.length === 0) {
        return { reply: 'No check-ins in the next 7 days.' };
      }

      const lines = arriving.map(b =>
        `- **${b.guest_name}** arrives ${fmtDate(b.arrive)} (${b.adults} adults${b.children ? ', ' + b.children + ' children' : ''}) — ${b.pavilion || 'TBD'}`
      );

      return {
        reply: `**Upcoming Check-ins:**\n\n${lines.join('\n')}`,
        metadata: { type: 'checkins', data: arriving },
      };
    },
  },
  {
    id: 'room_status',
    patterns: [/(room.*ready|room.*done|cleaned|prepared)/i],
    handler: async (db, ctx) => {
      // Log room readiness
      const id = generateId();
      await db.prepare(
        `INSERT INTO system_log (id, event, actor, channel, target_type, detail, created_at)
         VALUES (?, 'room_ready', ?, 'staff', 'pavilion', ?, datetime('now'))`
      ).bind(id, ctx.userId || 'staff', ctx.message || 'Room marked ready').run();

      return { reply: 'Room status logged. The manager has been notified.' };
    },
  },
  {
    id: 'request_leave',
    patterns: [/(leave|day off|time off|holiday)/i],
    handler: async (db, ctx) => ({
      reply: `Sure, let's request time off. What **start and end dates** do you need? (e.g. 10-14 May)`,
      flow: {
        flow: 'leave_request',
        step: 'ask_dates',
        slots: { staff_id: ctx.staffId || null, start_date: null, end_date: null, reason: null },
      },
    }),
  },
  {
    id: 'leave_status',
    patterns: [/(my leave|leave status|leave request)/i],
    handler: async (db, ctx) => {
      const staffId = ctx.staffId || 's_nomsa';
      const { results } = await db.prepare(
        `SELECT * FROM staff_leave_requests WHERE staff_id = ? ORDER BY created_at DESC LIMIT 5`
      ).bind(staffId).all();

      if (results.length === 0) return { reply: 'You have no leave requests on file.' };

      const lines = results.map(r =>
        `- ${fmtDate(r.start_date)}–${fmtDate(r.end_date)} (${r.days} days): **${r.status}**${r.reason ? ' — ' + r.reason : ''}`
      );

      return { reply: `**Your Leave Requests:**\n\n${lines.join('\n')}` };
    },
  },
  {
    id: 'fallback',
    patterns: [/.*/],
    handler: async () => ({
      reply: `I can help with:\n- **My schedule** — see your rotation\n- **Who's covering** — check other staff\n- **Guest check-ins** — upcoming arrivals\n- **Room status** — log room readiness\n- **Leave requests** — request or check time off`,
    }),
  },
];

// ─── Manager Intents ────────────────────────────────────────────────────────

const managerIntents = [
  {
    id: 'occupancy',
    patterns: [/(occupancy|how full|capacity|booked)/i],
    handler: async (db, ctx) => {
      const month = ctx.month || currentMonth();
      const { start, end } = monthRange(month);
      const bookings = await getBookingsForRange(db, start, end);
      const confirmed = bookings.filter(b => b.status !== 'Cancelled');

      // Total pavilion-nights in month
      const daysInMonth = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).getUTCDate();
      const totalSlots = 3 * daysInMonth; // 3 pavilions

      let bookedNights = 0;
      for (const b of confirmed) {
        const bStart = b.arrive < start ? start : b.arrive;
        const bEnd = b.depart > end ? end : b.depart;
        bookedNights += nights(bStart, bEnd);
      }

      const pct = Math.round((bookedNights / totalSlots) * 100);

      return {
        reply: `**Occupancy for ${month}:**\n\n- ${bookedNights} pavilion-nights booked out of ${totalSlots} available\n- **${pct}% occupancy**\n- ${confirmed.length} bookings`,
        metadata: { type: 'occupancy', data: { month, bookedNights, totalSlots, pct, count: confirmed.length } },
      };
    },
  },
  {
    id: 'revenue',
    patterns: [/(revenue|income|money|earned|turnover)/i],
    handler: async (db, ctx) => {
      const month = ctx.month || currentMonth();
      const { start, end } = monthRange(month);
      const bookings = await getBookingsForRange(db, start, end);
      const confirmed = bookings.filter(b => b.status !== 'Cancelled');

      let roomRevenue = 0;
      let levyTotal = 0;
      let phCommission = 0;

      for (const b of confirmed) {
        const n = nights(b.arrive, b.depart);
        const guests = (b.adults || 0) + (b.children || 0);
        roomRevenue += (b.base_rate || 0) * n;
        levyTotal += 180 * guests * n;
        if (b.source === 'Perfect Hideaways') {
          phCommission += (b.base_rate || 0) * n * 0.2;
        }
      }

      const netRevenue = roomRevenue - phCommission;

      return {
        reply: `**Revenue for ${month}:**\n\n- Room revenue: ${fmtMoney(roomRevenue)}\n- Conservation levy: ${fmtMoney(levyTotal)}\n- PH commission (20%): -${fmtMoney(phCommission)}\n- **Net revenue: ${fmtMoney(netRevenue)}**\n- Total collected: ${fmtMoney(roomRevenue + levyTotal)}`,
        metadata: { type: 'revenue', data: { month, roomRevenue, levyTotal, phCommission, netRevenue } },
      };
    },
  },
  {
    id: 'ph_commission',
    patterns: [/(commission|perfect hideaway|PH)/i],
    handler: async (db, ctx) => {
      const month = ctx.month || currentMonth();
      const { start, end } = monthRange(month);
      const bookings = await getBookingsForRange(db, start, end);
      const phBookings = bookings.filter(b => b.source === 'Perfect Hideaways' && b.status !== 'Cancelled');

      if (phBookings.length === 0) {
        return { reply: `No Perfect Hideaways bookings for ${month}.` };
      }

      let totalCommission = 0;
      const lines = phBookings.map(b => {
        const n = nights(b.arrive, b.depart);
        const gross = (b.base_rate || 0) * n;
        const comm = gross * 0.2;
        totalCommission += comm;
        return `- ${b.guest_name}: ${n} nights x ${fmtMoney(b.base_rate)} = ${fmtMoney(gross)} → commission ${fmtMoney(comm)}`;
      });

      return {
        reply: `**Perfect Hideaways Commission (${month}):**\n\n${lines.join('\n')}\n\n**Total commission: ${fmtMoney(totalCommission)}**`,
        metadata: { type: 'ph_commission', data: { month, phBookings, totalCommission } },
      };
    },
  },
  {
    id: 'approve_leave',
    patterns: [/(approve|grant|accept).*leave/i],
    handler: async (db, ctx) => {
      // Look for a pending leave request — ctx.requestId if provided
      const requestId = ctx.requestId;
      if (!requestId) {
        // List pending and ask which to approve
        const { results } = await db.prepare(
          `SELECT lr.*, s.name as staff_name FROM staff_leave_requests lr
           JOIN staff s ON lr.staff_id = s.id
           WHERE lr.status = 'Pending' ORDER BY lr.created_at`
        ).all();

        if (results.length === 0) return { reply: 'No pending leave requests.' };

        const lines = results.map(r =>
          `- **${r.id}**: ${r.staff_name} — ${fmtDate(r.start_date)} to ${fmtDate(r.end_date)} (${r.days} days)${r.reason ? ' — ' + r.reason : ''}`
        );

        return { reply: `**Pending Leave Requests:**\n\n${lines.join('\n')}\n\nReply with the request ID to approve.` };
      }

      await db.prepare(
        `UPDATE staff_leave_requests SET status = 'Approved', decided_by = ?, decided_at = datetime('now') WHERE id = ?`
      ).bind(ctx.userId || 'manager', requestId).run();

      return { reply: `Leave request **${requestId}** has been approved.` };
    },
  },
  {
    id: 'deny_leave',
    patterns: [/(deny|reject|decline).*leave/i],
    handler: async (db, ctx) => {
      const requestId = ctx.requestId;
      if (!requestId) {
        return { reply: 'Please specify the leave request ID to deny. Use "pending leave" to see open requests.' };
      }

      await db.prepare(
        `UPDATE staff_leave_requests SET status = 'Denied', decided_by = ?, decided_at = datetime('now') WHERE id = ?`
      ).bind(ctx.userId || 'manager', requestId).run();

      return { reply: `Leave request **${requestId}** has been denied.` };
    },
  },
  {
    id: 'pending_leave',
    patterns: [/(pending|outstanding).*(leave|request)/i],
    handler: async (db) => {
      const { results } = await db.prepare(
        `SELECT lr.*, s.name as staff_name FROM staff_leave_requests lr
         JOIN staff s ON lr.staff_id = s.id
         WHERE lr.status = 'Pending' ORDER BY lr.created_at`
      ).all();

      if (results.length === 0) return { reply: 'No pending leave requests.' };

      const lines = results.map(r =>
        `- **${r.id}**: ${r.staff_name} — ${fmtDate(r.start_date)} to ${fmtDate(r.end_date)} (${r.days} days)${r.reason ? ' — ' + r.reason : ''}`
      );

      return {
        reply: `**Pending Leave Requests:**\n\n${lines.join('\n')}\n\nSay "approve leave [ID]" or "deny leave [ID]" to action.`,
        metadata: { type: 'leave_requests', data: results },
      };
    },
  },
  {
    id: 'staff_status',
    patterns: [/(who.*working|staff.*today|on duty)/i],
    handler: async (db) => {
      const { results: allStaff } = await db.prepare(
        `SELECT * FROM staff WHERE active = 1`
      ).all();
      const today = new Date().toISOString().slice(0, 10);

      const lines = [];
      for (const s of allStaff) {
        const rotation = getRotationStatus(s.rotation_start, today);
        lines.push(`- **${s.name}** (${s.role}): ${rotation.toUpperCase()}`);
      }

      const guestsToday = await hasGuestsOnDate(db, today);

      return {
        reply: `**Staff Status (${fmtDate(today)}):**\n\n${lines.join('\n')}\n\nGuests in camp today: ${guestsToday ? 'Yes' : 'No'}`,
      };
    },
  },
  {
    id: 'booking_summary',
    patterns: [/(booking|upcoming|next guest)/i],
    handler: async (db, ctx) => {
      const month = ctx.month || currentMonth();
      const { start, end } = monthRange(month);
      const bookings = await getBookingsForRange(db, start, end);

      if (bookings.length === 0) {
        return { reply: `No bookings for ${month}.` };
      }

      const lines = bookings.map(b => {
        const n = nights(b.arrive, b.depart);
        const total = (b.base_rate || 0) * n;
        return `- **${b.guest_name}** | ${fmtDate(b.arrive)}–${fmtDate(b.depart)} (${n}n) | ${b.pavilion || 'TBD'} | ${b.source} | ${fmtMoney(total)} | ${b.status}`;
      });

      return {
        reply: `**Bookings for ${month}:**\n\n${lines.join('\n')}`,
        metadata: { type: 'booking_summary', data: bookings },
      };
    },
  },
  {
    id: 'fallback',
    patterns: [/.*/],
    handler: async () => ({
      reply: `I can help with:\n- **Occupancy** — how full is the lodge\n- **Revenue** — income and commissions\n- **Staff status** — who's working today\n- **Bookings** — upcoming guests\n- **Leave** — approve/deny requests`,
    }),
  },
];

// ─── Intent Detection ───────────────────────────────────────────────────────

const channelIntents = {
  guest: guestIntents,
  staff: staffIntents,
  manager: managerIntents,
};

/**
 * Detect intent from a message for a given channel.
 * Returns { id, handler } or the fallback.
 */
export function detectIntent(message, channel) {
  const intents = channelIntents[channel] || guestIntents;

  for (const intent of intents) {
    if (intent.id === 'fallback') continue;
    for (const pattern of intent.patterns) {
      if (pattern.test(message)) {
        return intent;
      }
    }
  }

  // Return fallback
  return intents.find(i => i.id === 'fallback') || intents[intents.length - 1];
}

/**
 * Execute an intent handler.
 */
export async function executeIntent(db, intent, ctx) {
  return intent.handler(db, ctx);
}
