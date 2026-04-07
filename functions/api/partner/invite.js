// /api/partner/invite
//
// POST  { partnerKey, email }              → grant invite
// DELETE { partnerKey, email }             → revoke invite
// GET   ?key=xxx                           → list invites + access log for that partner
//
// Only the partner's owners or admins can manage invites.

const PARTNER_REGISTRY = {
  'andile':          { owners: ['albert@andilesolutions.com','neil@andilesolutions.com','craigl@andilesolutions.com'] },
  'vibecrafters':    { owners: ['hello@vibecrafters.co.za','vibecrafterza@gmail.com'] },
  'agilex':          { owners: ['michael@agilex.co.za'] },
  'gridlineprop':    { owners: ['info@gridlineprop.co.za'] },
  'scanman':         { owners: ['info@scanman.co.za'] },
  'proximity-green': { owners: ['info@proximity-green.co.za'] },
  'dronescan':       { owners: ['info@dronescan.co.za'] },
  'hyram':           { owners: ['hyramserretta20@gmail.com'] },
  'carla':           { owners: ['carladeabreu@outlook.com'] },
  'nicola':          { owners: ['nicola@gananda.net'] },
  '20crm':           { owners: ['craig@2nth.ai'] },
};

const ADMIN_EMAILS = ['craig@2nth.ai', 'craigl@2nth.ai', 'imbilawork@gmail.com'];

function parseCookie(header, name) {
  const m = (header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

async function resolveSession(request, env) {
  const sid = parseCookie(request.headers.get('Cookie') || '', 'sid');
  if (sid && env.KV) {
    const raw = await env.KV.get(`session:${sid}`);
    if (raw) {
      try { const s = JSON.parse(raw); return { email: s.email?.toLowerCase(), role: s.role }; }
      catch { /* ignore */ }
    }
  }
  return null;
}

function canManage(session, partnerKey) {
  if (!session) return false;
  if (ADMIN_EMAILS.includes(session.email) || session.role === 'admin') return true;
  const partner = PARTNER_REGISTRY[partnerKey];
  return partner && partner.owners.includes(session.email);
}

// GET /api/partner/invite?key=xxx — list invites and recent access log
export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  const key = new URL(request.url).searchParams.get('key');

  if (!key || !PARTNER_REGISTRY[key]) return Response.json({ error: 'Unknown partner key' }, { status: 404 });
  if (!canManage(session, key)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // List all invites for this partner
  const inviteList = await env.KV.list({ prefix: `partner_invite:${key}:` });
  const invites = await Promise.all(
    inviteList.keys.map(async ({ name }) => {
      const raw = await env.KV.get(name);
      try { return JSON.parse(raw); } catch { return null; }
    })
  );

  // List recent access log entries (last 50)
  const logList = await env.KV.list({ prefix: `partner_access:${key}:` });
  const logs = await Promise.all(
    logList.keys.slice(-50).map(async ({ name }) => {
      const raw = await env.KV.get(name);
      try { return JSON.parse(raw); } catch { return null; }
    })
  );

  return Response.json({
    key,
    invites: invites.filter(Boolean),
    accessLog: logs.filter(Boolean).sort((a, b) => b.ts > a.ts ? 1 : -1),
  });
}

// POST /api/partner/invite — grant access to an email
export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { partnerKey, email } = body;
  if (!partnerKey || !email) return Response.json({ error: 'partnerKey and email required' }, { status: 400 });
  if (!PARTNER_REGISTRY[partnerKey]) return Response.json({ error: 'Unknown partner key' }, { status: 404 });
  if (!canManage(session, partnerKey)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const normalEmail = email.toLowerCase().trim();
  const kvKey = `partner_invite:${partnerKey}:${normalEmail}`;

  const invite = {
    partnerKey,
    email: normalEmail,
    grantedBy: session.email,
    grantedAt: new Date().toISOString(),
    active: true,
  };

  await env.KV.put(kvKey, JSON.stringify(invite));
  return Response.json({ granted: true, invite });
}

// DELETE /api/partner/invite — revoke access
export async function onRequestDelete(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { partnerKey, email } = body;
  if (!partnerKey || !email) return Response.json({ error: 'partnerKey and email required' }, { status: 400 });
  if (!PARTNER_REGISTRY[partnerKey]) return Response.json({ error: 'Unknown partner key' }, { status: 404 });
  if (!canManage(session, partnerKey)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const normalEmail = email.toLowerCase().trim();
  const kvKey = `partner_invite:${partnerKey}:${normalEmail}`;

  // Mark as revoked (keep record for audit) rather than deleting
  const existing = await env.KV.get(kvKey);
  let invite = {};
  try { invite = existing ? JSON.parse(existing) : {}; } catch { /* ignore */ }

  invite.active     = false;
  invite.revokedBy  = session.email;
  invite.revokedAt  = new Date().toISOString();

  await env.KV.put(kvKey, JSON.stringify(invite));
  return Response.json({ revoked: true, email: normalEmail });
}
