#!/usr/bin/env node
// Send welcome email to Kath Janisch — 2nth.ai Build Partner
// Usage: RESEND_API_KEY=re_xxx node scripts/send-welcome-kath-janisch.js

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) { console.error('Error: RESEND_API_KEY env var is required'); process.exit(1); }

const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3fafb;font-family:system-ui,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #d0eef4;">
  <div style="height:5px;background:linear-gradient(90deg,#0E1E2E 0%,#06B6D4 40%,#67E8F9 70%,#0E1E2E 100%)"></div>
  <div style="background:#0E1E2E;padding:22px 32px;display:flex;align-items:center;gap:12px;">
    <div style="font-family:Impact,sans-serif;font-size:20px;letter-spacing:4px;color:#fff"><span style="color:#06B6D4">2</span>NTH.AI</div>
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);font-family:monospace">DEVELOPERS</div>
  </div>
  <div style="padding:36px 32px;">
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#06B6D4;font-family:monospace;font-weight:700;margin-bottom:10px">Welcome to the build network</div>
    <h1 style="font-family:Impact,sans-serif;font-size:34px;letter-spacing:2px;color:#0E1E2E;margin:0 0 18px;line-height:1">KATH JANISCH</h1>
    <p style="font-size:15px;color:#1E4D5C;line-height:1.7;margin-bottom:16px">
      Welcome — you're now a <strong>Build Partner</strong> on 2nth.ai. Your profile is live and <strong>private by default</strong> — only you and the 2nth.ai admin team can see it until you choose to publish it.
    </p>
    <p style="font-size:14px;color:#2d6a7a;line-height:1.7;margin-bottom:24px">
      Your profile: <a href="https://developers.2nth.ai/partners/kath-janisch" style="color:#06B6D4;font-weight:600">developers.2nth.ai/partners/kath-janisch</a>
    </p>
    <div style="background:#f3fafb;border:1px solid #d0eef4;border-radius:10px;padding:22px;margin-bottom:24px">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#06B6D4;font-family:monospace;font-weight:700;margin-bottom:14px">Getting started checklist</div>
      <ol style="font-size:13px;color:#1E4D5C;line-height:1.9;padding-left:18px;margin:0">
        <li>Send your <strong>GitHub username</strong> to <a href="mailto:craig@2nth.ai" style="color:#06B6D4">craig@2nth.ai</a> to be added to the org</li>
        <li>Create a <a href="https://dash.cloudflare.com/sign-up" style="color:#06B6D4">Cloudflare account</a> if you don't have one (free)</li>
        <li>Install Wrangler: <code style="background:#e0f5f9;padding:1px 6px;border-radius:3px;font-size:12px">npm install -g wrangler</code> then <code style="background:#e0f5f9;padding:1px 6px;border-radius:3px;font-size:12px">wrangler login</code></li>
        <li>Sign in at <a href="https://2nth.ai" style="color:#06B6D4">2nth.ai</a> using GitHub OAuth</li>
        <li>Explore the <a href="https://developers.2nth.ai/docs.html" style="color:#06B6D4">developer docs</a> and the 2nth.ai skills catalog</li>
      </ol>
    </div>
    <div style="background:#0E1E2E;border-radius:10px;padding:20px 24px;margin-bottom:24px">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#06B6D4;font-family:monospace;font-weight:700;margin-bottom:12px">Platform stack</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:rgba(255,255,255,0.4);padding:4px 0;font-family:monospace;width:110px">Compute</td><td style="color:rgba(255,255,255,0.75);padding:4px 0">Cloudflare Pages + Workers</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4);padding:4px 0;font-family:monospace">AI Routing</td><td style="color:rgba(255,255,255,0.75);padding:4px 0">Workers AI (Llama 3.1 8B) → Claude via AI Gateway</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4);padding:4px 0;font-family:monospace">Database</td><td style="color:rgba(255,255,255,0.75);padding:4px 0">D1 (SQLite at edge) + KV + Vectorize</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4);padding:4px 0;font-family:monospace">Language</td><td style="color:rgba(255,255,255,0.75);padding:4px 0">TypeScript throughout</td></tr>
      </table>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="https://developers.2nth.ai/partners/kath-janisch" style="display:inline-block;background:#06B6D4;color:#fff;padding:11px 22px;border-radius:6px;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">View my profile →</a>
      <a href="https://developers.2nth.ai/docs.html" style="display:inline-block;background:none;border:1px solid #d0eef4;color:#06B6D4;padding:11px 22px;border-radius:6px;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">Developer docs →</a>
    </div>
    <p style="font-size:12px;color:#6AADBB;margin-top:24px;line-height:1.6">
      Questions? Reply here or reach Craig at <a href="mailto:craig@2nth.ai" style="color:#06B6D4">craig@2nth.ai</a><br>
      To make your profile visible to others, sign in and use the Sharing panel on your profile page.
    </p>
  </div>
  <div style="background:#f3fafb;border-top:1px solid #d0eef4;padding:14px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <div style="font-family:Impact,sans-serif;font-size:14px;letter-spacing:3px;color:#6AADBB"><span style="color:#06B6D4">2</span>NTH.AI</div>
    <div style="font-size:10px;color:#6AADBB;font-family:monospace">Build Partner Onboarding</div>
  </div>
</div>
</body></html>`;

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: '2NTH Developers <hello@2nth.ai>',
    to: ['kath@ctrlfuture.co.za', 'craig@b2bs.co.za'],
    reply_to: 'craig@2nth.ai',
    subject: 'Welcome to 2nth.ai — your build partner profile is ready, Kath',
    html,
  }),
});

const data = await res.json();
if (res.ok) { console.log('✓ Welcome email sent to kath@ctrlfuture.co.za + craig@b2bs.co.za\n  ID:', data.id); }
else { console.error('✗ Failed:', JSON.stringify(data, null, 2)); process.exit(1); }
