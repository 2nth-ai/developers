// POST /api/partner/onboard
// Admin-only. Creates a partner profile page, registers in KV, sends welcome email.
//
// Body (JSON):
//   firstName, lastName, email, linkedinUrl, type ('individual'|'org'),
//   bio (optional), skills (optional, comma-separated string),
//   paletteIndex (optional, 0-7)

import { ADMIN_EMAILS, PARTNER_REGISTRY } from '../../lib/registry.js';
import { resolveSession } from '../../lib/session.js';

// 8 curated colour palettes for individual partner pages
const PALETTES = [
  { p: '#1A1040', a: '#7C3AED', a2: '#6D28D9', s: '#F8F5FF', b: '#E4D9FF', b2: '#C4AEFF', f: '#9880CC', grad: '#EEE8FF' },
  { p: '#0C2A1A', a: '#10B981', a2: '#059669', s: '#F4FBF7', b: '#D9EEE3', b2: '#A7D9BC', f: '#6DA882', grad: '#EDFAF3' },
  { p: '#0D1F2D', a: '#0EA5E9', a2: '#0284C7', s: '#F4F9FC', b: '#DDE8F0', b2: '#A8C4D8', f: '#7A9CB0', grad: '#EDF6FC' },
  { p: '#2D1B0E', a: '#C4622D', a2: '#9E4C22', s: '#FAF7F4', b: '#EDE5DC', b2: '#D4BCA8', f: '#9E8070', grad: '#FAF2EA' },
  { p: '#2A1F3D', a: '#C0405E', a2: '#963048', s: '#FAF7FB', b: '#EAE2F0', b2: '#C8B8D8', f: '#9888A8', grad: '#F8F4FC' },
  { p: '#0F2D2D', a: '#0D9488', a2: '#0F766E', s: '#F4FAFA', b: '#CCE8E8', b2: '#9FD0D0', f: '#6AACAC', grad: '#ECFAFA' },
  { p: '#1A1A2E', a: '#3B82F6', a2: '#2563EB', s: '#F5F7FF', b: '#DDEAFF', b2: '#B0CAFF', f: '#7A9ACC', grad: '#EEF3FF' },
  { p: '#1C200E', a: '#84CC16', a2: '#65A30D', s: '#F7FAF4', b: '#D8ECC0', b2: '#B8D894', f: '#7AAA54', grad: '#EEFAE4' },
];

function toSlug(first, last) {
  return `${first}-${last}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function pickPalette(slug, idx) {
  if (idx !== undefined && idx >= 0 && idx < PALETTES.length) return PALETTES[idx];
  const hash = slug.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

function initials(first, last) {
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase();
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function generateProfileHtml({ slug, firstName, lastName, email, linkedinUrl, bio, skillsList, pal, isIndividual }) {
  const fullName = `${firstName} ${lastName}`.toUpperCase();
  const ini = initials(firstName, lastName);
  const displaySkills = skillsList.length
    ? skillsList.map(s => `<span class="badge badge-skill">${escHtml(s)}</span>`).join('\n          ')
    : '';

  const skillCards = skillsList.length ? skillsList.slice(0, 4).map((skill, i) => {
    const icons = ['💡','⚙️','🚀','📐','🔍','🌐','🤖','📊','🛠️','⚡'];
    return `
      <div class="expertise-card">
        <div class="icon">${icons[i % icons.length]}</div>
        <h4>${escHtml(skill)}</h4>
        <p>Hands-on experience applying ${escHtml(skill)} to build scalable, production-grade solutions.</p>
      </div>`;
  }).join('') : `
      <div class="expertise-card">
        <div class="icon">💡</div>
        <h4>Software Engineering</h4>
        <p>Building scalable, maintainable applications with a focus on clean architecture and performance.</p>
      </div>
      <div class="expertise-card">
        <div class="icon">🤖</div>
        <h4>AI-First Development</h4>
        <p>Integrating LLM capabilities and edge AI into production applications on the 2nth.ai platform.</p>
      </div>`;

  const linkedinBtn = linkedinUrl
    ? `<a href="${escHtml(linkedinUrl)}" target="_blank" rel="noopener" class="btn btn-primary">LinkedIn ↗</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(firstName)} ${escHtml(lastName)} — 2nth.ai Build Partner</title>
  <link rel="icon" type="image/svg+xml" href="https://2nth.ai/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary:  ${pal.p};
      --accent:   ${pal.a};
      --accent2:  ${pal.a2};
      --bg:       #FFFFFF;
      --surface:  ${pal.s};
      --border:   ${pal.b};
      --border2:  ${pal.b2};
      --faint:    ${pal.f};
      --mono: 'JetBrains Mono', monospace;
      --display: 'Bebas Neue', Impact, sans-serif;
      --body: 'Barlow', system-ui, sans-serif;
    }
    html { scroll-behavior: smooth; }
    body { background: #fff; color: var(--primary); font-family: var(--body); font-size: 16px; line-height: 1.6; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }
    section { padding: 60px 0; border-bottom: 1px solid var(--border); }
    section:last-of-type { border-bottom: none; }
    .brand-stripe { height: 5px; background: linear-gradient(90deg, ${pal.p} 0%, ${pal.a} 45%, ${pal.b2} 75%, ${pal.p} 100%); }
    nav { background: ${pal.p}; border-bottom: 1px solid ${pal.a}33; position: sticky; top: 0; z-index: 50; }
    .nav-inner { max-width: 960px; margin: 0 auto; padding: 0 24px; height: 54px; display: flex; align-items: center; justify-content: space-between; }
    .nav-logo { font-family: var(--display); font-size: 20px; letter-spacing: 3px; color: #fff; text-decoration: none; }
    .nav-logo span { color: ${pal.a}; }
    .nav-breadcrumb { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
    .nav-breadcrumb a { color: rgba(255,255,255,0.5); text-decoration: none; }
    .nav-breadcrumb a:hover { color: ${pal.a}; }
    .nav-breadcrumb .sep { color: rgba(255,255,255,0.2); }
    .nav-breadcrumb .current { color: rgba(255,255,255,0.85); }
    .hero { padding: 68px 0 56px; background: linear-gradient(160deg, ${pal.grad} 0%, #fff 55%); border-bottom: 1px solid var(--border); }
    .partner-lockup { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; flex-wrap: wrap; }
    .partner-avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, ${pal.p}, ${pal.a}); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: var(--display); font-size: 24px; letter-spacing: 2px; color: #fff; }
    .partner-name { font-family: var(--display); font-size: clamp(30px, 4.5vw, 52px); letter-spacing: 1.5px; color: var(--primary); line-height: 1; margin-bottom: 4px; }
    .partner-title { font-family: var(--mono); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
    .partner-meta { font-family: var(--mono); font-size: 11px; color: var(--faint); display: flex; gap: 16px; flex-wrap: wrap; }
    .badge { display: inline-flex; align-items: center; font-family: var(--mono); font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; font-weight: 700; margin: 2px; }
    .badge-build { background: ${pal.a}14; border: 1px solid ${pal.a}4D; color: var(--accent); }
    .badge-skill { background: ${pal.p}12; border: 1px solid ${pal.p}33; color: var(--primary); }
    .expertise-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin: 24px 0; }
    .expertise-card { background: var(--primary); border-radius: 10px; padding: 22px; }
    .expertise-card .icon { font-size: 22px; margin-bottom: 10px; }
    .expertise-card h4 { font-family: var(--mono); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); margin: 0 0 6px; }
    .expertise-card p { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0; line-height: 1.5; }
    .model-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 28px; margin: 24px 0; }
    .model-row { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); }
    .model-row:last-child { border-bottom: none; padding-bottom: 0; }
    .model-who { font-family: var(--mono); font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); width: 80px; flex-shrink: 0; padding-top: 2px; }
    .model-what { font-size: 14px; color: var(--primary); opacity: .75; line-height: 1.6; }
    .cta-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border); }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; font-family: var(--mono); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; text-decoration: none; transition: all .15s; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: ${pal.p}ee; text-decoration: none; }
    .btn-accent { background: var(--accent); color: #fff; }
    .btn-accent:hover { background: var(--accent2); text-decoration: none; }
    .btn-outline { background: none; border: 1px solid var(--border2); color: var(--primary); opacity: .7; }
    .btn-outline:hover { border-color: var(--primary); opacity: 1; text-decoration: none; }
    footer { padding: 28px 0; border-top: 1px solid var(--border); background: var(--surface); }
    .footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .footer-logo { font-family: var(--display); font-size: 16px; letter-spacing: 3px; color: var(--faint); }
    .footer-logo span { color: var(--accent); }
    .footer-links { display: flex; gap: 20px; }
    .footer-links a { font-family: var(--mono); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--faint); text-decoration: none; }
    .footer-links a:hover { color: var(--primary); }
  </style>
</head>
<body data-partner="${escHtml(slug)}">
<div class="brand-stripe"></div>
<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo"><span>2</span>NTH.AI</a>
    <div class="nav-breadcrumb">
      <a href="/portal.html">Portal</a>
      <span class="sep">/</span>
      <span class="current">${escHtml(firstName)} ${escHtml(lastName)}</span>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="wrap">
    <div class="partner-lockup">
      <div class="partner-avatar">${ini}</div>
      <div>
        <div class="partner-name">${escHtml(fullName)}</div>
        <div class="partner-title">Software Engineer · Development Build Partner</div>
        <div class="partner-meta">
          <span>South Africa</span>
          ${skillsList.length ? `<span>|</span><span>${skillsList.slice(0,3).map(escHtml).join(' · ')}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <span class="badge badge-build">Build Partner</span>
          ${displaySkills}
        </div>
      </div>
    </div>
    <p style="font-size:1.05rem;color:var(--primary);opacity:.7;max-width:700px;line-height:1.8">
      ${escHtml(bio || `${firstName} ${lastName} is a 2nth.ai Development Build Partner, focused on building scalable, intuitive applications on the edge-AI platform.`)}
    </p>
  </div>
</section>

<section>
  <div class="wrap">
    <h2 style="font-family:var(--display);font-size:clamp(24px,3vw,36px);letter-spacing:1px;margin-bottom:12px">Technical focus</h2>
    <p style="font-size:15px;opacity:.65;max-width:660px;line-height:1.7;margin-bottom:0">
      Building production-grade systems on the 2nth.ai edge platform — Cloudflare Workers, D1, KV, and AI-first engineering.
    </p>
    <div class="expertise-grid">${skillCards}</div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2 style="font-family:var(--display);font-size:clamp(24px,3vw,36px);letter-spacing:1px;margin-bottom:12px">Build partnership</h2>
    <div class="model-box">
      <div class="model-row">
        <div class="model-who">${escHtml(firstName)}</div>
        <div class="model-what">Ships skills, integrations, and edge-native features on the 2nth.ai platform. Clean TypeScript targeting the Cloudflare Workers runtime. PRs target dev → beta → main.</div>
      </div>
      <div class="model-row">
        <div class="model-who">2nth.ai</div>
        <div class="model-what">Platform access, Workers AI token budget, D1 and KV bindings, code review, and the skills catalog. AI inference via AI Gateway (Llama 3.1 8B → Claude Sonnet 4.6).</div>
      </div>
      <div class="model-row">
        <div class="model-who">Stack</div>
        <div class="model-what">TypeScript · Cloudflare Pages + Workers · D1 · KV · Vectorize · R2 · Workers AI. No Docker, no VMs. Edge-first, globally distributed.</div>
      </div>
    </div>
    <div class="cta-bar">
      ${linkedinBtn}
      <a href="/docs.html" class="btn btn-outline">Dev Docs</a>
      <a href="https://2nth.ai" class="btn btn-accent">2nth.ai ↗</a>
      <a href="/portal.html" class="btn btn-outline">Portal</a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="footer-inner">
      <div class="footer-logo"><span>2</span>NTH.AI DEVELOPERS</div>
      <div class="footer-links">
        <a href="/portal.html">Portal</a>
        <a href="/docs.html">Docs</a>
        <a href="https://2nth.ai">Platform</a>
      </div>
    </div>
  </div>
</footer>

<script src="/partner-visibility.js"></script>
<script src="https://2nth-beta.pages.dev/env-banner.js"></script>
</body>
</html>`;
}

async function sendWelcomeEmail(env, { email, firstName, lastName, slug }) {
  if (!env.RESEND_API_KEY) return;
  const profileUrl = `https://developers.2nth.ai/partners/${slug}`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto">
  <div style="height:4px;background:linear-gradient(90deg,#1A1040,#7C3AED,#A78BFA,#1A1040)"></div>
  <div style="background:#1A1040;padding:20px 28px">
    <div style="font-family:Impact,sans-serif;font-size:20px;letter-spacing:4px;color:#fff"><span style="color:#7C3AED">2</span>NTH.AI <span style="font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.4)">DEVELOPERS</span></div>
  </div>
  <div style="padding:32px 28px;border:1px solid #e4e4e7;border-top:none">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7C3AED;font-family:monospace;margin-bottom:10px">Welcome to the build network</div>
    <h1 style="font-family:Impact,sans-serif;font-size:32px;letter-spacing:2px;color:#1A1040;margin:0 0 18px">${escHtml(firstName.toUpperCase())} ${escHtml(lastName.toUpperCase())}</h1>
    <p style="font-size:15px;color:#3f3f46;line-height:1.7;margin-bottom:16px">You're now a <strong>Development Build Partner</strong> on 2nth.ai. Your profile is live — private to you until you choose to publish it.</p>
    <p style="font-size:14px;color:#52525b;line-height:1.7;margin-bottom:24px">Profile: <a href="${profileUrl}" style="color:#7C3AED">${profileUrl}</a></p>
    <div style="background:#f8f5ff;border:1px solid #e4d9ff;border-radius:8px;padding:20px;margin-bottom:24px">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7C3AED;font-family:monospace;font-weight:700;margin-bottom:12px">Getting started</div>
      <ol style="font-size:13px;color:#3f3f46;line-height:1.9;padding-left:20px;margin:0">
        <li>Send your <strong>GitHub username</strong> to <a href="mailto:craig@2nth.ai" style="color:#7C3AED">craig@2nth.ai</a> to be added to the org</li>
        <li>Create a <a href="https://dash.cloudflare.com/sign-up" style="color:#7C3AED">Cloudflare account</a> (free)</li>
        <li>Install: <code style="background:#ede9fe;padding:1px 6px;border-radius:3px">npm install -g wrangler</code> then <code style="background:#ede9fe;padding:1px 6px;border-radius:3px">wrangler login</code></li>
        <li>Sign in at <a href="https://2nth.ai" style="color:#7C3AED">2nth.ai</a> with GitHub OAuth</li>
        <li>Read the <a href="https://developers.2nth.ai/docs.html" style="color:#7C3AED">developer docs</a> and build your first skill</li>
      </ol>
    </div>
    <a href="${profileUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:11px 24px;border-radius:6px;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">View my profile →</a>
    <p style="font-size:12px;color:#a1a1aa;margin-top:20px">Questions? Reply to this email or reach Craig at <a href="mailto:craig@2nth.ai" style="color:#7C3AED">craig@2nth.ai</a></p>
  </div>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: '2NTH Developers <hello@2nth.ai>',
      to: [email, 'imbilawork@gmail.com'],
      reply_to: 'craig@2nth.ai',
      subject: `Welcome to 2nth.ai — your build partner profile is ready, ${firstName}`,
      html,
    }),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Admin only
  const session = await resolveSession(request, env);
  if (!session.email || (!ADMIN_EMAILS.includes(session.email) && session.role !== 'admin')) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { firstName, lastName, email, linkedinUrl, type = 'individual', bio = '', skills = '', paletteIndex } = body;

  if (!firstName || !lastName || !email) {
    return Response.json({ error: 'firstName, lastName, and email are required' }, { status: 400 });
  }

  const slug = toSlug(firstName, lastName);

  // Check for existing static partner
  if (PARTNER_REGISTRY[slug]) {
    return Response.json({ error: `Partner key "${slug}" already exists in the static registry` }, { status: 409 });
  }

  // Check KV for existing dynamic partner
  const existing = env.KV ? await env.KV.get(`partner_registry:${slug}`) : null;
  if (existing) {
    return Response.json({ error: `Partner "${slug}" already exists` }, { status: 409 });
  }

  const skillsList = skills
    ? skills.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const isIndividual = type !== 'org';
  const pal = pickPalette(slug, paletteIndex);

  // Generate profile HTML
  const html = generateProfileHtml({ slug, firstName, lastName, email, linkedinUrl, bio, skillsList, pal, isIndividual });

  // Persist to KV
  const now = new Date().toISOString();
  const partnerData = {
    slug, firstName, lastName, email, linkedinUrl, type, bio, skillsList,
    paletteIndex: PALETTES.indexOf(pal),
    createdBy: session.email,
    createdAt: now,
    active: true,
    individual: isIndividual,
    owners: [email.toLowerCase()],
  };

  await Promise.all([
    env.KV.put(`partner_page:${slug}`, html),
    env.KV.put(`partner_registry:${slug}`, JSON.stringify(partnerData)),
    env.KV.put(`partner_email:${email.toLowerCase()}`, JSON.stringify({ key: slug, active: true, createdAt: now })),
  ]);

  // Send welcome email (fire and forget — don't fail the request if email fails)
  sendWelcomeEmail(env, { email, firstName, lastName, slug }).catch(() => {});

  return Response.json({
    success: true,
    slug,
    profileUrl: `https://developers.2nth.ai/partners/${slug}`,
    previewUrl: `/partners/${slug}`,
  });
}
