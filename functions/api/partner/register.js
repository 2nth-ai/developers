// POST /api/partner/register — partner self-registration (public endpoint)
//
// Body: { name, email, company, type?, message?, source? }
// Creates a pending partner record in KV and emails admin.

import { createPendingPartner } from '../../lib/partners.js';
import { ADMIN_EMAILS } from '../../lib/registry.js';

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, company, type = 'individual', message = '', source = 'self' } = body;

  if (!name || !email || !company) {
    return Response.json({ error: 'name, email, and company are required' }, { status: 400 });
  }

  const emailNorm = email.toLowerCase().trim();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(emailNorm)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  if (!env.KV) {
    return Response.json({ error: 'Registration unavailable — storage not configured' }, { status: 503 });
  }

  // Check if already registered
  const existing = await env.KV.get(`partner_email:${emailNorm}`);
  if (existing) {
    return Response.json({ error: 'This email is already registered as a partner' }, { status: 409 });
  }

  // Generate a unique key
  let key = slugify(company || name);
  const taken = await env.KV.get(`partner:${key}`);
  if (taken) key = `${key}-${Date.now().toString(36)}`;

  let record;
  try {
    record = await createPendingPartner(env, { key, name, email: emailNorm, company, type, message });
  } catch (err) {
    console.error('[register] createPendingPartner failed:', err);
    return Response.json({ error: 'Registration failed — please try again' }, { status: 500 });
  }

  // Notify admin
  if (env.RESEND_API_KEY) {
    const adminEmail = ADMIN_EMAILS[0] || 'imbilawork@gmail.com';
    const approveUrl = `${env.SITE_URL || 'https://developers.2nth.ai'}/admin.html#pending`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM || '2NTH Developers <hello@2nth.ai>',
        to: ['imbilawork@gmail.com'],
        reply_to: emailNorm,
        subject: `[Partner Request] ${escapeHtml(company)} — ${escapeHtml(name)}`,
        html: `
          <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;font-weight:700;margin-bottom:16px">NEW PARTNER REGISTRATION</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:6px 0;color:#6b7280;width:100px">Name</td><td style="padding:6px 0;font-weight:600">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(emailNorm)}" style="color:#7c3aed">${escapeHtml(emailNorm)}</a></td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Company</td><td style="padding:6px 0">${escapeHtml(company)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Type</td><td style="padding:6px 0">${escapeHtml(type)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Key</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(key)}</td></tr>
              ${message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Message</td><td style="padding:6px 0">${escapeHtml(message)}</td></tr>` : ''}
            </table>
            <div style="margin-top:24px">
              <a href="${approveUrl}" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">Review in Admin Panel</a>
            </div>
            <div style="margin-top:16px;font-size:11px;color:#9ca3af">Or approve via API: POST /api/partner/approve { key: "${escapeHtml(key)}" }</div>
          </div>`,
      }),
    }).catch(err => console.error('[register] admin notify failed:', err));

    // Confirmation to applicant
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM || '2NTH Developers <hello@2nth.ai>',
        to: [emailNorm],
        subject: `Your 2nth partner application — ${escapeHtml(company)}`,
        html: `
          <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
            <div style="font-size:24px;font-weight:700;color:#111;margin-bottom:8px">Application received</div>
            <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${escapeHtml(name)},</p>
            <p style="color:#374151;font-size:15px;line-height:1.6">
              We've received your application to join the 2nth developer partner network.
              We'll review it and be in touch within 1–2 business days.
            </p>
            <p style="color:#6b7280;font-size:13px;margin-top:24px">Questions? Reply to this email.</p>
          </div>`,
      }),
    }).catch(err => console.error('[register] applicant confirm failed:', err));
  }

  return Response.json({ ok: true, key, status: 'pending' }, { status: 201 });
}
