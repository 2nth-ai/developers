// GET /api/access-signin?id=...&code=...&return=... — sign in with ID + PIN
// No emails exposed in URLs or HTML

const USERS = {
  'craig':    { email: 'craig@2nth.ai',         name: 'Craig Leppan',  scope: 'full',                    code: '3325' },
  'craig-pg': { email: 'craig@proximity.green', name: 'Craig Leppan',  scope: 'proximity-green,luthuli', code: '3325' },
  'mark':     { email: 'mark@proximity.green',  name: 'Mark',          scope: 'proximity-green',         code: '7746' },
  'guy':      { email: 'guy@rumf.co.za',        name: 'Guy Hamlin',    scope: 'full',                     code: '5591' },
  'jasper':   { email: 'jasper@dronescan.co',  name: 'Jasper',        scope: 'dronescan,scanman,luthuli', code: '3847' },
  'craig-b2b':{ email: 'craig@b2bs.co.za',   name: 'Craig Leppan',  scope: 'full',                    code: '3325' },
  'kath':     { email: 'kath@ctrlfuture.co.za', name: 'Katherine Janisch', scope: 'ctrl-future',          code: '4418' },
  'republic': { email: 'info@republiclifestyle.co.za', name: 'Republic Lifestyle', scope: 'republic-lifestyle', code: '1971' },
  'emma':     { email: 'emma@vibecrafters.com',       name: 'Emma Leppan',         scope: 'vibecrafters',         code: '0902' },
};
const ADMIN_DOMAINS = ['2nth.ai', '2nth.io', 'b2bs.co.za'];

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const code = (url.searchParams.get('code') || '').trim();
  const returnTo = url.searchParams.get('return') || '/hub.html';

  // Legacy support: if email param is passed (direct URL), still work
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (email) {
    const user = Object.values(USERS).find(u => u.email === email);
    if (!user) return Response.redirect(`${url.origin}/access.html?error=unknown&return=${encodeURIComponent(returnTo)}`, 302);
    return setSessionAndRedirect(url.origin, user, returnTo);
  }

  if (!id) {
    return Response.redirect(`${url.origin}/access.html?error=missing&return=${encodeURIComponent(returnTo)}`, 302);
  }

  const user = USERS[id];
  if (!user) {
    return Response.redirect(`${url.origin}/access.html?error=unknown&return=${encodeURIComponent(returnTo)}`, 302);
  }

  if (code !== user.code) {
    return Response.redirect(`${url.origin}/access.html?error=code&return=${encodeURIComponent(returnTo)}`, 302);
  }

  return setSessionAndRedirect(url.origin, user, returnTo);
}

function setSessionAndRedirect(origin, user, returnTo) {
  const session = JSON.stringify({
    email: user.email,
    name: user.name,
    approved: true,
    scope: user.scope,
    fullAccess: user.scope === 'full',
    at: new Date().toISOString(),
  });

  const maxAge = 60 * 60 * 24 * 30;
  const cookie = `dev_access=${btoa(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': returnTo,
      'Set-Cookie': cookie,
    },
  });
}
