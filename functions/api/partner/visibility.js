// POST /api/partner/visibility
// Body: { partnerKey: string, audience: 'all' | 'partners' | 'private', action: 'set' }
// GET  /api/partner/visibility?key=xxx — returns current settings
//
// Requires authenticated session — only the partner's own owners or admin can modify.
// Returns: { key, audience, updated }

const PARTNER_REGISTRY = {
  'andile':           { owners: ['albert@andilesolutions.com','neil@andilesolutions.com','craigl@andilesolutions.com'] },
  'vibecrafters':     { owners: ['hello@vibecrafters.co.za', 'vibecrafterza@gmail.com'] },
  'agilex':           { owners: ['michael@agilex.co.za'] },
  'gridlineprop':     { owners: ['info@gridlineprop.co.za'] },
  'scanman':          { owners: ['info@scanman.co.za'] },
  'proximity-green':  { owners: ['info@proximity-green.co.za'] },
  'dronescan':        { owners: ['info@dronescan.co.za'] },
  'hyram':            { owners: ['hyramserretta20@gmail.com'] },
  'carla':            { owners: ['carladeabreu@outlook.com'] },
  'nicola':           { owners: ['nicola@gananda.net'] },
  '20crm':            { owners: ['craig@2nth.ai'] },
};

const ADMIN_EMAILS = ['craig@2nth.ai', 'craigl@2nth.ai', 'imbilawork@gmail.com'];

function parseCookie(header, name) {
  const match = (header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : null;
}

async function resolveSession(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const sid = parseCookie(cookies, 'sid');
  if (sid && env.KV) {
    const raw = await env.KV.get(`session:${sid}`);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        return { email: s.email?.toLowerCase(), role: s.role };
      } catch { /* ignore */ }
    }
  }
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  const key = new URL(request.url).searchParams.get('key');
  if (!key || !PARTNER_REGISTRY[key]) {
    return Response.json({ error: 'Unknown partner key' }, { status: 404 });
  }

  const partner = PARTNER_REGISTRY[key];
  const isAdmin = ADMIN_EMAILS.includes(session.email) || session.role === 'admin';
  const isOwner = partner.owners.includes(session.email);
  if (!isAdmin && !isOwner) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [all, partners] = await Promise.all([
    env.KV.get(`partner_public:${key}:all`),
    env.KV.get(`partner_public:${key}:partners`),
  ]);

  let audience = 'private';
  if (all === 'true') audience = 'all';
  else if (partners === 'true') audience = 'partners';

  return Response.json({ key, audience });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await resolveSession(request, env);
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { partnerKey, audience } = body;
  if (!partnerKey || !['all', 'partners', 'private'].includes(audience)) {
    return Response.json({ error: 'partnerKey and audience (all|partners|private) required' }, { status: 400 });
  }

  const partner = PARTNER_REGISTRY[partnerKey];
  if (!partner) return Response.json({ error: 'Unknown partner key' }, { status: 404 });

  const isAdmin = ADMIN_EMAILS.includes(session.email) || session.role === 'admin';
  const isOwner = partner.owners.includes(session.email);
  if (!isAdmin && !isOwner) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Set KV flags based on audience choice
  await Promise.all([
    env.KV.put(`partner_public:${partnerKey}:all`,      audience === 'all'      ? 'true' : 'false'),
    env.KV.put(`partner_public:${partnerKey}:partners`, audience === 'partners' ? 'true' : 'false'),
  ]);

  return Response.json({ key: partnerKey, audience, updated: true });
}
