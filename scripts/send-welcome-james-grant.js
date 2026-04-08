#!/usr/bin/env node
// Send welcome email to James Grant — 2nth.ai Development Build Partner
// Usage: RESEND_API_KEY=re_xxx node scripts/send-welcome-james-grant.js

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY env var is required');
  process.exit(1);
}

const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4fbf7;font-family:'Barlow',system-ui,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #d9eee3;">

  <!-- Header -->
  <div style="height:5px;background:linear-gradient(90deg,#0C2A1A 0%,#10B981 40%,#34D399 70%,#0C2A1A 100%)"></div>
  <div style="background:#0C2A1A;padding:24px 32px;display:flex;align-items:center;gap:12px;">
    <div style="font-family:Impact,sans-serif;font-size:22px;letter-spacing:4px;color:#fff"><span style="color:#10B981">2</span>NTH.AI</div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);font-family:monospace">DEVELOPERS</div>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#10B981;font-family:monospace;margin-bottom:12px;font-weight:700">Welcome to the build network</div>
    <h1 style="font-family:Impact,sans-serif;font-size:36px;letter-spacing:2px;color:#0C2A1A;margin:0 0 20px;line-height:1">JAMES GRANT</h1>

    <p style="font-size:15px;color:#1F5C38;line-height:1.7;margin-bottom:20px">
      Welcome aboard — you're now registered as a <strong>Development Build Partner</strong> on the 2nth.ai platform. We're glad to have you building with us.
    </p>

    <p style="font-size:14px;color:#2d6a47;line-height:1.7;margin-bottom:28px">
      Your profile is live at <a href="https://developers.2nth.ai/partners/james-grant" style="color:#10B981;font-weight:600">developers.2nth.ai/partners/james-grant</a>. Below are the steps to get your development environment set up so you can start building on the platform.
    </p>

    <!-- Getting started steps -->
    <div style="background:#f4fbf7;border:1px solid #d9eee3;border-radius:10px;padding:24px;margin-bottom:28px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6DA882;font-family:monospace;font-weight:700;margin-bottom:18px">Getting started checklist</div>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:28px;padding:10px 0;vertical-align:top">
            <div style="font-family:Impact,sans-serif;font-size:20px;color:#10B981;line-height:1">1</div>
          </td>
          <td style="padding:10px 0 10px 12px;border-bottom:1px solid #d9eee3;">
            <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#10B981;font-family:monospace;font-weight:700;margin-bottom:3px">Create a GitHub account</div>
            <div style="font-size:13px;color:#2d6a47;line-height:1.6">Sign up at <a href="https://github.com" style="color:#10B981">github.com</a> if you don't already have one. Choose a professional username — it will be visible on your skill contributions. Once done, send your GitHub username to <a href="mailto:craig@2nth.ai" style="color:#10B981">craig@2nth.ai</a> so you can be added to the 2nth.ai org.</div>
          </td>
        </tr>
        <tr>
          <td style="width:28px;padding:10px 0;vertical-align:top">
            <div style="font-family:Impact,sans-serif;font-size:20px;color:#10B981;line-height:1">2</div>
          </td>
          <td style="padding:10px 0 10px 12px;border-bottom:1px solid #d9eee3;">
            <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#10B981;font-family:monospace;font-weight:700;margin-bottom:3px">Create a Cloudflare account</div>
            <div style="font-size:13px;color:#2d6a47;line-height:1.6">Sign up at <a href="https://dash.cloudflare.com/sign-up" style="color:#10B981">dash.cloudflare.com</a>. The free plan is sufficient to start. You'll use this account for local Wrangler authentication and eventually to deploy your own Pages/Workers projects.</div>
          </td>
        </tr>
        <tr>
          <td style="width:28px;padding:10px 0;vertical-align:top">
            <div style="font-family:Impact,sans-serif;font-size:20px;color:#10B981;line-height:1">3</div>
          </td>
          <td style="padding:10px 0 10px 12px;border-bottom:1px solid #d9eee3;">
            <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#10B981;font-family:monospace;font-weight:700;margin-bottom:3px">Install the toolchain</div>
            <div style="font-size:13px;color:#2d6a47;line-height:1.6">
              Install Node.js ≥18 from <a href="https://nodejs.org" style="color:#10B981">nodejs.org</a>, then:<br>
              <code style="background:#e8f5ee;padding:2px 8px;border-radius:4px;font-size:12px;display:inline-block;margin-top:6px">npm install -g wrangler</code><br>
              <code style="background:#e8f5ee;padding:2px 8px;border-radius:4px;font-size:12px;display:inline-block;margin-top:4px">wrangler login</code><br>
              <span style="font-size:12px;color:#6DA882;margin-top:4px;display:block">This opens a browser to authenticate with your Cloudflare account.</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="width:28px;padding:10px 0;vertical-align:top">
            <div style="font-family:Impact,sans-serif;font-size:20px;color:#10B981;line-height:1">4</div>
          </td>
          <td style="padding:10px 0 10px 12px;border-bottom:1px solid #d9eee3;">
            <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#10B981;font-family:monospace;font-weight:700;margin-bottom:3px">Sign in to the platform</div>
            <div style="font-size:13px;color:#2d6a47;line-height:1.6">Sign in at <a href="https://2nth.ai" style="color:#10B981">2nth.ai</a> using GitHub OAuth. Your GitHub account becomes your platform identity — skills you contribute will be linked to your handle. Then sign in to the <a href="https://developers.2nth.ai/portal.html" style="color:#10B981">Developer Portal</a> to access your partner dashboard.</div>
          </td>
        </tr>
        <tr>
          <td style="width:28px;padding:10px 0;vertical-align:top">
            <div style="font-family:Impact,sans-serif;font-size:20px;color:#10B981;line-height:1">5</div>
          </td>
          <td style="padding:10px 0 10px 12px;">
            <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#10B981;font-family:monospace;font-weight:700;margin-bottom:3px">Build your first skill</div>
            <div style="font-size:13px;color:#2d6a47;line-height:1.6">Read the <a href="https://developers.2nth.ai/docs.html" style="color:#10B981">developer docs</a> to understand the SKILL.md format. Pick a domain and problem you know well. Create your skill directory, write the SKILL.md, and open a PR against <code style="background:#e8f5ee;padding:2px 6px;border-radius:3px;font-size:12px">dev</code>. We review within 48 hours.</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Platform stack quick ref -->
    <div style="background:#0C2A1A;border-radius:10px;padding:24px;margin-bottom:28px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#10B981;font-family:monospace;font-weight:700;margin-bottom:14px">Platform stack — quick reference</div>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px;width:120px">Compute</td><td style="color:rgba(255,255,255,0.8);padding:5px 0">Cloudflare Pages + Workers</td></tr>
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px">Database</td><td style="color:rgba(255,255,255,0.8);padding:5px 0">D1 (SQLite at the edge)</td></tr>
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px">Sessions</td><td style="color:rgba(255,255,255,0.8);padding:5px 0">KV (key-value store)</td></tr>
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px">AI Routing</td><td style="color:rgba(255,255,255,0.8);padding:5px 0">Workers AI (Llama 3.1 8B) → Claude via AI Gateway</td></tr>
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px">RAG</td><td style="color:rgba(255,255,255,0.8);padding:5px 0">Vectorize + R2</td></tr>
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px">Language</td><td style="color:rgba(255,255,255,0.8);padding:5px 0">TypeScript throughout</td></tr>
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px">Dev cmd</td><td style="color:rgba(255,255,255,0.8);padding:5px 0;font-family:monospace">npm run dev</td></tr>
        <tr><td style="color:rgba(255,255,255,0.45);padding:5px 0;font-family:monospace;font-size:11px">Deploy</td><td style="color:rgba(255,255,255,0.8);padding:5px 0;font-family:monospace">npm run deploy</td></tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;padding:8px 0 4px">
      <a href="https://developers.2nth.ai/docs.html" style="display:inline-block;background:#10B981;color:#fff;padding:12px 28px;border-radius:7px;font-family:monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;margin-right:8px">Read the docs →</a>
      <a href="https://2nth.ai" style="display:inline-block;background:#0C2A1A;color:#fff;padding:12px 28px;border-radius:7px;font-family:monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">Sign in to 2nth.ai →</a>
    </div>

    <p style="font-size:12px;color:#6DA882;margin-top:28px;line-height:1.6;text-align:center">
      Questions? Reply to this email or reach Craig directly at <a href="mailto:craig@2nth.ai" style="color:#10B981">craig@2nth.ai</a><br>
      Your partner profile: <a href="https://developers.2nth.ai/partners/james-grant" style="color:#10B981">developers.2nth.ai/partners/james-grant</a>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f4fbf7;border-top:1px solid #d9eee3;padding:16px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <div style="font-family:Impact,sans-serif;font-size:14px;letter-spacing:3px;color:#6DA882"><span style="color:#10B981">2</span>NTH.AI</div>
    <div style="font-size:11px;color:#6DA882;font-family:monospace">Development Build Partner — Onboarding</div>
  </div>
</div>
</body>
</html>
`;

const payload = {
  from: '2NTH Developers <hello@2nth.ai>',
  to: ['jamesgrant321@proton.me', 'craig@b2bs.co.za'],
  reply_to: 'craig@2nth.ai',
  subject: 'Welcome to 2nth.ai — your developer build partner account is ready',
  html,
};

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const data = await res.json();

if (res.ok) {
  console.log('✓ Welcome email sent to jamesgrant321@proton.me');
  console.log('  Email ID:', data.id);
} else {
  console.error('✗ Failed to send email:', JSON.stringify(data, null, 2));
  process.exit(1);
}
