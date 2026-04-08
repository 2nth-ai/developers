// POST /api/partner/approve — admin approves or rejects a pending partner
//
// Body: { key, action: 'approve' | 'reject', note? }
// Requires admin session.

import { ADMIN_EMAILS } from '../../lib/registry.js';
import { resolveSession } from '../../lib/session.js';
import { approvePartner, listPendingPartners } from '../../lib/partners.js';

function isAdmin(email, role) {
  return ADMIN_EMAILS.includes(email) || role === 'admin';
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// GET /api/partner/approve — list pending partners
export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!isAdmin(session.email, session.role)) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }
  const pending = await listPendingPartners(env);
  return Response.json({ pending });
}

// POST /api/partner/approve
export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!isAdmin(session.email, session.role)) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, action = 'approve', note = '' } = body;
  if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
  if (!['approve', 'reject'].includes(action)) {
    return Response.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  if (!env.KV) return Response.json({ error: 'KV not available' }, { status: 503 });

  const raw = await env.KV.get(`partner:${key}`);
  if (!raw) return Response.json({ error: `Partner "${key}" not found` }, { status: 404 });

  const partner = JSON.parse(raw);

  if (action === 'reject') {
    partner.status = 'rejected';
    partner.rejectedAt = new Date().toISOString();
    partner.rejectedBy = session.email;
    partner.rejectionNote = note;
    await env.KV.put(`partner:${key}`, JSON.stringify(partner));
    await env.KV.delete(`partner_pending:${key}`);

    // Notify applicant
    if (env.RESEND_API_KEY && partner.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.RESEND_FROM || '2NTH Developers <hello@2nth.ai>',
          to: [partner.email],
          subject: 'Your 2nth partner application',
          html: `<div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
            <p style="font-size:15px;color:#374151">Hi ${escapeHtml(partner.name)},</p>
            <p style="font-size:15px;color:#374151;line-height:1.6">
              Thank you for applying to the 2nth developer network. After review we're unable to
              approve your application at this time.
              ${note ? `<br><br>${escapeHtml(note)}` : ''}
            </p>
            <p style="font-size:13px;color:#6b7280;margin-top:24px">
              Questions? Reply to this email.
            </p>
          </div>`,
        }),
      }).catch(() => {});
    }

    return Response.json({ ok: true, key, status: 'rejected' });
  }

  // Approve
  let record;
  try {
    record = await approvePartner(env, key, session.email);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  // Send welcome email
  if (env.RESEND_API_KEY && record.email) {
    const siteUrl = env.SITE_URL || 'https://developers.2nth.ai';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM || '2NTH Developers <hello@2nth.ai>',
        to: [record.email],
        subject: `Welcome to 2nth.ai — you're in, ${escapeHtml(record.name)}`,
        html: `<div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;font-weight:700;margin-bottom:16px">2NTH DEVELOPERS</div>
          <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:12px">You're approved ✓</div>
          <p style="font-size:15px;color:#374151;line-height:1.6">
            Hi ${escapeHtml(record.name)}, your partner account is active.
            Sign in to access the developer portal and manage your profile.
          </p>
          <div style="margin:28px 0">
            <a href="${siteUrl}/" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">Sign in to the portal →</a>
          </div>
          <p style="font-size:13px;color:#6b7280">
            Your partner page will be at: <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">${siteUrl}/partners/${escapeHtml(record.key)}</code><br>
            You can update your profile and set visibility from your dashboard.
          </p>
        </div>`,
      }),
    }).catch(() => {});
  }

  return Response.json({ ok: true, key, status: 'active', record });
}
