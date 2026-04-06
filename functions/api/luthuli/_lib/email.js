// Luthuli Lodge — Email notifications via Resend

const MANAGERS = [
  { name: 'Guy Hamlin', email: 'guy@rumf.co.za' },
  { name: 'Lisa-Jane Hamlin', email: 'hamlin@mweb.co.za' },
];

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dt = new Date(d + 'T00:00:00Z');
  return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function fmtMoney(n) {
  return 'R' + Number(n).toLocaleString('en-ZA');
}

/**
 * Check if emails are enabled (toggle stored in KV).
 * Default: enabled.
 */
export async function emailsEnabled(kv) {
  if (!kv) return true;
  try {
    const val = await kv.get('luthuli:email_enabled');
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * Toggle email notifications on/off.
 */
export async function setEmailEnabled(kv, enabled) {
  if (!kv) return;
  await kv.put('luthuli:email_enabled', enabled ? 'true' : 'false');
}

/**
 * Send booking notification to managers.
 * Called when a new booking is created via guest chat.
 */
export async function sendBookingNotification(env, booking) {
  const enabled = await emailsEnabled(env.SESSIONS);
  if (!enabled) return { sent: false, reason: 'emails_disabled' };

  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) return { sent: false, reason: 'no_resend_key' };

  const n = Math.round((new Date(booking.depart + 'T00:00:00Z') - new Date(booking.arrive + 'T00:00:00Z')) / 86400000);
  const totalGuests = (booking.adults || 0) + (booking.children || 0);
  const roomTotal = (booking.base_rate || 0) * n;
  const levy = 180 * totalGuests * n;

  const html = `
    <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
      <div style="background: #3d3229; padding: 20px 24px; border-radius: 10px 10px 0 0;">
        <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(250,249,246,.5);">LUTHULI LODGE</div>
        <div style="font-size: 20px; font-weight: 700; color: #faf9f6; margin-top: 4px;">New Booking Request</div>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 10px 10px;">
        <table style="width: 100%; font-size: 14px; color: #44403c; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #8a8075; width: 130px;">Guest</td><td style="padding: 8px 0; font-weight: 600;">${esc(booking.name)}</td></tr>
          <tr><td style="padding: 8px 0; color: #8a8075;">Email</td><td style="padding: 8px 0;">${esc(booking.email)}</td></tr>
          <tr><td style="padding: 8px 0; color: #8a8075;">Dates</td><td style="padding: 8px 0; font-weight: 600;">${fmtDate(booking.arrive)} — ${fmtDate(booking.depart)} (${n} nights)</td></tr>
          <tr><td style="padding: 8px 0; color: #8a8075;">Guests</td><td style="padding: 8px 0;">${booking.adults} adults${booking.children ? ', ' + booking.children + ' children' : ''}</td></tr>
          <tr><td style="padding: 8px 0; color: #8a8075;">Pavilion</td><td style="padding: 8px 0; font-weight: 600;">${esc(booking.pavilion)}</td></tr>
          <tr><td style="padding: 8px 0; color: #8a8075;">Guide</td><td style="padding: 8px 0;">${esc(booking.guide || 'None')}</td></tr>
          <tr><td style="padding: 8px 0; color: #8a8075;">Source</td><td style="padding: 8px 0;">${esc(booking.source || 'Direct')}</td></tr>
          <tr style="border-top: 1px solid #e7e5e4;"><td style="padding: 8px 0; color: #8a8075;">Room</td><td style="padding: 8px 0; font-weight: 600;">${fmtMoney(roomTotal)}</td></tr>
          <tr><td style="padding: 8px 0; color: #8a8075;">Conservation levy</td><td style="padding: 8px 0;">${fmtMoney(levy)} (${totalGuests} × ${n} × R180)</td></tr>
          <tr style="border-top: 1px solid #e7e5e4;"><td style="padding: 12px 0; color: #3d3229; font-weight: 700;">Total</td><td style="padding: 12px 0; font-size: 18px; font-weight: 700; color: #3d3229;">${fmtMoney(roomTotal + levy)}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 12px; background: #faf9f6; border-radius: 6px; font-size: 12px; color: #8a8075;">
          Status: <strong style="color: #d97706;">Pending Approval</strong><br>
          Ref: <strong>${esc(booking.id)}</strong><br>
          Booked via: Guest WhatsApp Agent
        </div>
        <a href="https://dev-luthuli-agents.developers-2nth-ai.pages.dev/preview/luthuli/manage.html" style="display: inline-block; margin-top: 16px; background: #5a7a5c; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">Open Manager Dashboard →</a>
      </div>
    </div>
  `;

  const results = [];
  for (const mgr of MANAGERS) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Luthuli Lodge <hello@2nth.ai>',
          to: [mgr.email],
          subject: `New Booking: ${booking.name} — ${fmtDate(booking.arrive)} to ${fmtDate(booking.depart)}`,
          html,
        }),
      });
      results.push({ to: mgr.email, sent: true });
    } catch (e) {
      results.push({ to: mgr.email, sent: false, error: e.message });
    }
  }

  return { sent: true, recipients: results };
}

/**
 * Send booking confirmation to the guest.
 */
export async function sendGuestConfirmation(env, booking) {
  const enabled = await emailsEnabled(env.SESSIONS);
  if (!enabled) return { sent: false, reason: 'emails_disabled' };

  const resendKey = env.RESEND_API_KEY;
  if (!resendKey || !booking.email) return { sent: false, reason: 'no_resend_key_or_email' };

  const n = Math.round((new Date(booking.depart + 'T00:00:00Z') - new Date(booking.arrive + 'T00:00:00Z')) / 86400000);
  const totalGuests = (booking.adults || 0) + (booking.children || 0);
  const roomTotal = (booking.base_rate || 0) * n;
  const levy = 180 * totalGuests * n;

  const html = `
    <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
      <div style="background: #3d3229; padding: 20px 24px; border-radius: 10px 10px 0 0;">
        <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(250,249,246,.5);">LUTHULI LODGE</div>
        <div style="font-size: 20px; font-weight: 700; color: #faf9f6; margin-top: 4px;">Booking Confirmation</div>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 15px; color: #44403c; margin: 0 0 16px;">Dear ${esc(booking.name)},</p>
        <p style="font-size: 14px; color: #57534e; margin: 0 0 20px;">Thank you for your booking at Luthuli Lodge. Here are your details:</p>
        <table style="width: 100%; font-size: 14px; color: #44403c; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #8a8075; width: 130px;">Dates</td><td style="padding: 6px 0; font-weight: 600;">${fmtDate(booking.arrive)} — ${fmtDate(booking.depart)} (${n} nights)</td></tr>
          <tr><td style="padding: 6px 0; color: #8a8075;">Guests</td><td style="padding: 6px 0;">${booking.adults} adults${booking.children ? ', ' + booking.children + ' children' : ''}</td></tr>
          <tr><td style="padding: 6px 0; color: #8a8075;">Pavilion</td><td style="padding: 6px 0; font-weight: 600;">${esc(booking.pavilion)}</td></tr>
          <tr><td style="padding: 6px 0; color: #8a8075;">Guide</td><td style="padding: 6px 0;">${esc(booking.guide || 'None')}</td></tr>
          <tr style="border-top: 1px solid #e7e5e4;"><td style="padding: 8px 0; color: #8a8075;">Room rate</td><td style="padding: 8px 0;">${fmtMoney(roomTotal)}</td></tr>
          <tr><td style="padding: 6px 0; color: #8a8075;">Conservation levy</td><td style="padding: 6px 0;">${fmtMoney(levy)}</td></tr>
          <tr style="border-top: 1px solid #e7e5e4;"><td style="padding: 8px 0; font-weight: 700;">Total</td><td style="padding: 8px 0; font-weight: 700; font-size: 16px;">${fmtMoney(roomTotal + levy)}</td></tr>
        </table>
        <div style="margin-top: 20px; padding: 14px; background: #d4e6d5; border-radius: 6px; font-size: 13px; color: #3a5a3c;">
          <strong>Reference:</strong> ${esc(booking.id)}<br>
          The conservation levy supports anti-poaching, wildlife monitoring, and habitat restoration.
        </div>
        <p style="font-size: 13px; color: #8a8075; margin-top: 16px;">For any changes or questions, reply to this email or contact us directly.</p>
        <p style="font-size: 13px; color: #8a8075; margin-top: 8px;">We look forward to welcoming you to Luthuli!</p>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Luthuli Lodge <hello@2nth.ai>',
        to: [booking.email],
        cc: MANAGERS.map(m => m.email),
        subject: `Your Luthuli Lodge Booking — ${fmtDate(booking.arrive)} to ${fmtDate(booking.depart)}`,
        html,
      }),
    });
    return { sent: true, to: booking.email };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

/**
 * Send staff schedule/leave notification.
 */
export async function sendStaffNotification(env, { staffName, staffEmail, subject, body }) {
  const enabled = await emailsEnabled(env.SESSIONS);
  if (!enabled) return { sent: false, reason: 'emails_disabled' };

  const resendKey = env.RESEND_API_KEY;
  if (!resendKey || !staffEmail) return { sent: false, reason: 'no_resend_key_or_email' };

  const html = `
    <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
      <div style="background: #3d3229; padding: 16px 24px; border-radius: 10px 10px 0 0;">
        <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(250,249,246,.5);">LUTHULI LODGE</div>
        <div style="font-size: 18px; font-weight: 700; color: #faf9f6; margin-top: 4px;">${esc(subject)}</div>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 14px; color: #44403c;">Hi ${esc(staffName)},</p>
        <div style="font-size: 14px; color: #57534e; line-height: 1.6;">${body}</div>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Luthuli Lodge <hello@2nth.ai>',
        to: [staffEmail],
        cc: MANAGERS.map(m => m.email),
        subject: `Luthuli Lodge — ${subject}`,
        html,
      }),
    });
    return { sent: true, to: staffEmail };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}
