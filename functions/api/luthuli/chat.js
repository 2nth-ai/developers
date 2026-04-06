// POST /api/luthuli/chat
// Agent-first chat endpoint — routes messages through intent detection + multi-turn flows
import { initDB, generateId } from './_lib/db.js';
import { detectIntent, executeIntent } from './_lib/intents.js';

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
  const kv = env.SESSIONS;

  await initDB(db);

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  const { message, channel = 'guest', userId, userName, month } = body;

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'message is required' }), { status: 400, headers: CORS });
  }

  const effectiveUserId = userId || 'anon_' + channel;
  const effectiveUserName = userName || channel;

  // Store user message
  const userMsgId = generateId();
  await db.prepare(
    `INSERT INTO chat_messages (id, channel, user_id, user_name, role, content, created_at)
     VALUES (?, ?, ?, ?, 'user', ?, datetime('now'))`
  ).bind(userMsgId, channel, effectiveUserId, effectiveUserName, message).run();

  // Check for active multi-turn flow
  const flowKey = `luthuli:flow:${effectiveUserId}`;
  let flowState = null;
  try {
    const stored = await kv.get(flowKey, 'json');
    if (stored) flowState = stored;
  } catch { /* no flow */ }

  let reply, metadata, intentId, newFlow;

  if (flowState) {
    // Handle slot fill in active flow
    const result = await handleFlow(db, flowState, message, { userId: effectiveUserId, channel, month });
    reply = result.reply;
    metadata = result.metadata;
    intentId = `flow:${flowState.flow}:${flowState.step}`;

    if (result.flow) {
      // Continue flow
      await kv.put(flowKey, JSON.stringify(result.flow), { expirationTtl: 1800 });
    } else {
      // Flow complete — remove
      await kv.delete(flowKey);
    }
  } else {
    // Intent detection
    const intent = detectIntent(message, channel);
    intentId = intent.id;

    const ctx = { userId: effectiveUserId, userName: effectiveUserName, message, channel, month };
    const result = await executeIntent(db, intent, ctx);

    reply = result.reply;
    metadata = result.metadata;

    // If the intent starts a flow, store it
    if (result.flow) {
      await kv.put(flowKey, JSON.stringify(result.flow), { expirationTtl: 1800 });
    }
  }

  // Store agent response
  const agentMsgId = generateId();
  await db.prepare(
    `INSERT INTO chat_messages (id, channel, user_id, user_name, role, content, intent, metadata, created_at)
     VALUES (?, ?, 'agent', 'Luthuli Agent', 'assistant', ?, ?, ?, datetime('now'))`
  ).bind(agentMsgId, channel, reply, intentId, metadata ? JSON.stringify(metadata) : null).run();

  const responseBody = { reply };
  if (metadata) responseBody.metadata = metadata;

  return new Response(JSON.stringify(responseBody), { status: 200, headers: CORS });
}

// ─── Multi-turn Flow Handlers ───────────────────────────────────────────────

async function handleFlow(db, state, message, ctx) {
  if (state.flow === 'booking') {
    return handleBookingFlow(db, state, message, ctx);
  }
  if (state.flow === 'leave_request') {
    return handleLeaveFlow(db, state, message, ctx);
  }
  // Unknown flow — cancel
  return { reply: 'Something went wrong with our conversation. Let\'s start fresh — how can I help?' };
}

async function handleBookingFlow(db, state, message, ctx) {
  const slots = state.slots;

  switch (state.step) {
    case 'ask_dates': {
      // Try to parse dates from message like "15-18 April" or "2026-04-15 to 2026-04-18"
      const parsed = parseDateRange(message);
      if (!parsed) {
        return {
          reply: 'I couldn\'t parse those dates. Please try a format like "15-18 April" or "2026-04-15 to 2026-04-18".',
          flow: state,
        };
      }
      slots.arrive = parsed.arrive;
      slots.depart = parsed.depart;
      return {
        reply: `Got it — **${fmtDate(parsed.arrive)} to ${fmtDate(parsed.depart)}**.\n\nHow many **adults** and **children**? (e.g. "2 adults, 1 child")`,
        flow: { ...state, step: 'ask_guests', slots },
      };
    }

    case 'ask_guests': {
      const adults = parseInt((message.match(/(\d+)\s*adult/i) || [])[1]) || parseInt(message) || 2;
      const children = parseInt((message.match(/(\d+)\s*child/i) || [])[1]) || 0;
      slots.adults = adults;
      slots.children = children;
      return {
        reply: `${adults} adults${children ? ', ' + children + ' children' : ''}. Got it.\n\nWhich **pavilion** would you prefer?\n- River Pavilion (sleeps 4, R2 800/night)\n- Bush Pavilion (sleeps 2, R2 800/night)\n- Sunset Pavilion (sleeps 6, R4 200/night)`,
        flow: { ...state, step: 'ask_pavilion', slots },
      };
    }

    case 'ask_pavilion': {
      const lower = message.toLowerCase();
      let pavilion = null;
      let rate = 0;
      if (lower.includes('river')) { pavilion = 'River Pavilion'; rate = 2800; }
      else if (lower.includes('bush')) { pavilion = 'Bush Pavilion'; rate = 2800; }
      else if (lower.includes('sunset')) { pavilion = 'Sunset Pavilion'; rate = 4200; }
      else {
        return {
          reply: 'Please choose: **River**, **Bush**, or **Sunset** Pavilion.',
          flow: state,
        };
      }
      slots.pavilion = pavilion;
      slots.base_rate = rate;
      return {
        reply: `**${pavilion}** — great choice!\n\nWould you like a **guide** for game drives?\n- Thabo (big cats & tracking specialist)\n- Sipho (birding & night drives)\n- External guide\n- No guide needed`,
        flow: { ...state, step: 'ask_guide', slots },
      };
    }

    case 'ask_guide': {
      const lower = message.toLowerCase();
      let guide = 'None';
      if (lower.includes('thabo')) guide = 'Thabo';
      else if (lower.includes('sipho')) guide = 'Sipho';
      else if (lower.includes('external')) guide = 'External';
      else if (lower.includes('no')) guide = 'None';
      slots.guide = guide;
      return {
        reply: `Guide: **${guide}**.\n\nFinally — what **name** should the booking be under?`,
        flow: { ...state, step: 'ask_name', slots },
      };
    }

    case 'ask_name': {
      slots.name = message.trim();
      return {
        reply: `Booking for **${slots.name}**.\n\nAnd your **email** for confirmation?`,
        flow: { ...state, step: 'ask_email', slots },
      };
    }

    case 'ask_email': {
      slots.email = message.trim();

      // Calculate totals
      const n = nights(slots.arrive, slots.depart);
      const totalGuests = slots.adults + slots.children;
      const roomTotal = slots.base_rate * n;
      const levyTotal = 180 * totalGuests * n;

      return {
        reply: `Here's your booking summary:\n\n- **Guest:** ${slots.name}\n- **Dates:** ${fmtDate(slots.arrive)} – ${fmtDate(slots.depart)} (${n} nights)\n- **Guests:** ${slots.adults} adults${slots.children ? ', ' + slots.children + ' children' : ''}\n- **Pavilion:** ${slots.pavilion}\n- **Guide:** ${slots.guide}\n- **Room:** ${fmtMoney(roomTotal)} (${n} x ${fmtMoney(slots.base_rate)})\n- **Levy:** ${fmtMoney(levyTotal)} (${totalGuests} guests x ${n} nights x R180)\n- **Total:** ${fmtMoney(roomTotal + levyTotal)}\n\nShall I **confirm** this booking? (yes/no)`,
        flow: { ...state, step: 'confirm', slots },
      };
    }

    case 'confirm': {
      if (/^(yes|y|confirm|sure|ok)/i.test(message)) {
        // Create guest + booking
        const guestId = generateId();
        await db.prepare(
          `INSERT INTO guests (id, name, email, source) VALUES (?, ?, ?, 'Direct')`
        ).bind(guestId, slots.name, slots.email).run();

        const bookingId = generateId();
        const n = nights(slots.arrive, slots.depart);
        await db.prepare(
          `INSERT INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes)
           VALUES (?, ?, 'Direct', ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Booked via chat')`
        ).bind(bookingId, guestId, slots.arrive, slots.depart, slots.adults, slots.children, slots.pavilion, slots.guide, slots.base_rate).run();

        // Log it
        await db.prepare(
          `INSERT INTO system_log (id, event, actor, channel, target_type, target_id, detail, created_at)
           VALUES (?, 'booking_created', ?, 'guest', 'booking', ?, ?, datetime('now'))`
        ).bind(generateId(), ctx.userId, bookingId, `${slots.name} - ${slots.arrive} to ${slots.depart}`).run();

        return {
          reply: `Booking confirmed! Reference: **${bookingId}**\n\nA confirmation will be sent to ${slots.email}. We look forward to hosting you at Luthuli Lodge!`,
          metadata: { type: 'booking_card', data: { bookingId, ...slots, nights: n } },
        };
      } else {
        return { reply: 'No problem — booking cancelled. Let me know if you\'d like to start again!' };
      }
    }

    default:
      return { reply: 'Let\'s start fresh. How can I help?' };
  }
}

async function handleLeaveFlow(db, state, message, ctx) {
  const slots = state.slots;

  switch (state.step) {
    case 'ask_dates': {
      const parsed = parseDateRange(message);
      if (!parsed) {
        return {
          reply: 'I couldn\'t parse those dates. Try "10-14 May" or "2026-05-10 to 2026-05-14".',
          flow: state,
        };
      }
      slots.start_date = parsed.arrive;
      slots.end_date = parsed.depart;
      slots.days = nights(parsed.arrive, parsed.depart);
      return {
        reply: `${fmtDate(parsed.arrive)} to ${fmtDate(parsed.depart)} (${slots.days} days). What's the **reason**?`,
        flow: { ...state, step: 'ask_reason', slots },
      };
    }

    case 'ask_reason': {
      slots.reason = message.trim();
      const staffId = slots.staff_id || 's_nomsa';

      const requestId = generateId();
      await db.prepare(
        `INSERT INTO staff_leave_requests (id, staff_id, start_date, end_date, days, status, reason, created_at)
         VALUES (?, ?, ?, ?, ?, 'Pending', ?, datetime('now'))`
      ).bind(requestId, staffId, slots.start_date, slots.end_date, slots.days, slots.reason).run();

      await db.prepare(
        `INSERT INTO system_log (id, event, actor, channel, target_type, target_id, detail, created_at)
         VALUES (?, 'leave_requested', ?, 'staff', 'leave_request', ?, ?, datetime('now'))`
      ).bind(generateId(), ctx.userId, requestId, `${slots.start_date} to ${slots.end_date}`).run();

      return {
        reply: `Leave request submitted! Reference: **${requestId}**\n\n- ${fmtDate(slots.start_date)} to ${fmtDate(slots.end_date)} (${slots.days} days)\n- Reason: ${slots.reason}\n- Status: **Pending**\n\nThe manager will review your request.`,
      };
    }

    default:
      return { reply: 'Let\'s start fresh. How can I help?' };
  }
}

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

/**
 * Parse a date range from natural language.
 * Supports: "15-18 April", "15 to 18 April 2026", "2026-04-15 to 2026-04-18"
 */
function parseDateRange(text) {
  const currentYear = new Date().getFullYear();

  // ISO format: 2026-04-15 to 2026-04-18
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})\s*(to|-|–)\s*(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return { arrive: isoMatch[1], depart: isoMatch[3] };
  }

  const monthNames = {
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', jun: '06', june: '06',
    jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
    oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
  };

  // "15-18 April" or "15 to 18 April" or "15-18 April 2026"
  const rangeMatch = text.match(/(\d{1,2})\s*(to|-|–)\s*(\d{1,2})\s+(\w+)\s*(\d{4})?/i);
  if (rangeMatch) {
    const day1 = rangeMatch[1].padStart(2, '0');
    const day2 = rangeMatch[3].padStart(2, '0');
    const monthStr = rangeMatch[4].toLowerCase();
    const year = rangeMatch[5] || currentYear;
    const month = monthNames[monthStr];
    if (month) {
      return {
        arrive: `${year}-${month}-${day1}`,
        depart: `${year}-${month}-${day2}`,
      };
    }
  }

  // "15 April to 18 April" or "15 April - 20 May"
  const fullMatch = text.match(/(\d{1,2})\s+(\w+)\s*(to|-|–)\s*(\d{1,2})\s+(\w+)\s*(\d{4})?/i);
  if (fullMatch) {
    const day1 = fullMatch[1].padStart(2, '0');
    const m1 = monthNames[fullMatch[2].toLowerCase()];
    const day2 = fullMatch[4].padStart(2, '0');
    const m2 = monthNames[fullMatch[5].toLowerCase()];
    const year = fullMatch[6] || currentYear;
    if (m1 && m2) {
      return {
        arrive: `${year}-${m1}-${day1}`,
        depart: `${year}-${m2}-${day2}`,
      };
    }
  }

  return null;
}
