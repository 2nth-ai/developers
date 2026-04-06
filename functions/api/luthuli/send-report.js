// POST /api/luthuli/send-report — Send the platform report email to Guy and Craig
import { initDB } from './_lib/db.js';

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
  const { env } = context;
  const resendKey = env.RESEND_API_KEY || env.RESEND_KEY;
  if (!resendKey) {
    // Debug: list available env keys (non-sensitive)
    const keys = Object.keys(env).filter(k => !k.includes('SECRET') && !k.includes('KEY'));
    return new Response(JSON.stringify({ error: 'No Resend API key found', available_bindings: keys }), { status: 500, headers: CORS });
  }

  const reportUrl = 'https://dev-luthuli-agents.developers-2nth-ai.pages.dev/preview/luthuli/report.html';
  const managerUrl = 'https://dev-luthuli-agents.developers-2nth-ai.pages.dev/preview/luthuli/manage.html';
  const guestUrl = 'https://dev-luthuli-agents.developers-2nth-ai.pages.dev/preview/luthuli/chat/guest.html';
  const staffUrl = 'https://dev-luthuli-agents.developers-2nth-ai.pages.dev/preview/luthuli/chat/staff.html';

  const html = `
<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #faf9f6;">

  <!-- Header -->
  <div style="background: #3d3229; padding: 32px; border-radius: 12px 12px 0 0;">
    <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: rgba(250,249,246,.4);">LUTHULI LODGE</div>
    <div style="font-size: 26px; font-weight: 700; color: #faf9f6; font-family: Georgia, serif; margin-top: 6px;">Agent Platform — Ready for Testing</div>
    <div style="font-size: 13px; color: rgba(250,249,246,.6); margin-top: 8px;">Built by 2nth.ai — April 2026</div>
  </div>

  <!-- Body -->
  <div style="background: #fff; padding: 32px; border: 1px solid #e7e5e4; border-top: none;">

    <p style="font-size: 15px; color: #292524; margin: 0 0 16px;">Hi Guy,</p>

    <p style="font-size: 14px; color: #57534e; line-height: 1.7; margin: 0 0 16px;">We've built an agent-first management system for Luthuli Lodge. Instead of a traditional app with logins and menus, everything is driven by AI agents that you, your guests, and your staff talk to naturally.</p>

    <p style="font-size: 14px; color: #57534e; line-height: 1.7; margin: 0 0 20px;">It's live and ready for you to test. Here's what's working:</p>

    <!-- What's live -->
    <div style="background: #faf9f6; border: 1px solid #e7e5e4; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #059669; font-weight: 700; margin-bottom: 12px;">✓ LIVE NOW</div>
      <table style="width: 100%; font-size: 13px; color: #57534e; border-collapse: collapse;">
        <tr><td style="padding: 4px 0;">✅ Guest booking via WhatsApp-style agent</td></tr>
        <tr><td style="padding: 4px 0;">✅ Staff roster — 21/7 rotation, coverage calendar</td></tr>
        <tr><td style="padding: 4px 0;">✅ Booking timeline — Gantt view per pavilion</td></tr>
        <tr><td style="padding: 4px 0;">✅ Direct vs Perfect Hideaways (20% commission)</td></tr>
        <tr><td style="padding: 4px 0;">✅ Conservation levy (R180/person/night)</td></tr>
        <tr><td style="padding: 4px 0;">✅ Email notifications to you & Lisa-Jane</td></tr>
        <tr><td style="padding: 4px 0;">✅ Manager dashboard — occupancy, revenue, finance</td></tr>
        <tr><td style="padding: 4px 0;">✅ Google Calendar & .ics export</td></tr>
        <tr><td style="padding: 4px 0;">✅ Cloud database — all data persists</td></tr>
      </table>
    </div>

    <!-- Quick links -->
    <div style="margin-bottom: 24px;">
      <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #a8a29e; font-weight: 600; margin-bottom: 10px;">TEST IT NOW</div>

      <a href="${managerUrl}" style="display: block; background: #3d3229; color: #faf9f6; padding: 14px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
        🏠 Manager Dashboard — Sign in with guy@rumf.co.za →
      </a>

      <div style="display: flex; gap: 8px;">
        <a href="${guestUrl}" style="flex: 1; display: block; background: #075e54; color: #fff; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; text-align: center;">
          💬 Guest Agent
        </a>
        <a href="${staffUrl}" style="flex: 1; display: block; background: #007aff; color: #fff; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; text-align: center;">
          📱 Staff Agent
        </a>
      </div>
    </div>

    <!-- How to test -->
    <div style="background: #d4e6d5; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 13px; color: #3a5a3c; font-weight: 600; margin-bottom: 6px;">Quick Test Guide</div>
      <ol style="font-size: 12px; color: #3a5a3c; line-height: 1.8; margin: 0; padding-left: 18px;">
        <li>Open the Manager Dashboard and sign in with your email</li>
        <li>Ask the agent: "What's occupancy?" or tap the quick buttons</li>
        <li>Check the Staff tab — see the 28-day roster</li>
        <li>Open the Guest Agent — try making a booking (you'll get an email!)</li>
        <li>Check the Plan tab for the full roadmap</li>
      </ol>
    </div>

    <!-- Proposal -->
    <div style="border: 2px solid #059669; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
      <div style="font-size: 16px; font-weight: 700; color: #059669; margin-bottom: 6px;">Pilot Proposal</div>
      <p style="font-size: 13px; color: #57534e; margin: 0 0 8px;">4-week paid pilot — R25,000 setup + R2,500/mo</p>
      <p style="font-size: 13px; color: #57534e; margin: 0 0 8px;">Includes: real WhatsApp, SMS for staff, email processing, payments, Claude AI upgrade</p>
      <p style="font-size: 14px; color: #059669; font-weight: 700; margin: 0;"><strong>Full refund if it doesn't go to production.</strong></p>
    </div>

    <!-- Full report link -->
    <a href="${reportUrl}" style="display: block; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 20px; text-decoration: none; text-align: center; font-size: 13px; color: #5a7a5c; font-weight: 600;">
      📄 View Full Report →
    </a>

    <p style="font-size: 13px; color: #a8a29e; margin: 20px 0 0; text-align: center;">Let's set up a call to walk through it together.</p>

  </div>

  <!-- Footer -->
  <div style="padding: 16px; text-align: center; font-size: 10px; color: #a8a29e;">
    Luthuli Lodge · Mkuzi Game Reserve · Powered by <a href="https://2nth.ai" style="color: #5a7a5c;">2nth.ai</a>
  </div>

</div>
  `;

  const results = [];
  const recipients = ['guy@rumf.co.za', 'craig@2nth.ai'];

  for (const to of recipients) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Luthuli Lodge <hello@2nth.ai>',
          to: [to],
          subject: 'Luthuli Lodge — Agent Platform Ready for Testing',
          html,
        }),
      });
      const data = await res.json();
      results.push({ to, sent: true, id: data.id });
    } catch (e) {
      results.push({ to, sent: false, error: e.message });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Report emails sent',
    results,
  }), { headers: CORS });
}
