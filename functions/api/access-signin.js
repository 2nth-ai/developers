// GET /api/access-signin?email=...&return=... — instant sign-in for known users
// Sets cookie via 302 redirect (the pattern that works)

const KNOWN_USERS = {
  'craig@2nth.ai':         { name: 'Craig Leppan',  scope: 'full' },
  'craig@proximity.green': { name: 'Craig Leppan',  scope: 'proximity-green,luthuli' },
  'mark@proximity.green':  { name: 'Mark',          scope: 'proximity-green' },
  'guy@rumf.co.za':        { name: 'Guy Hamlin',    scope: 'luthuli' },
};
const ADMIN_DOMAINS = ['2nth.ai', '2nth.io'];

function getKnownUser(email) {
  if (KNOWN_USERS[email]) return KNOWN_USERS[email];
  var domain = email.split('@')[1];
  if (ADMIN_DOMAINS.includes(domain)) return { name: email.split('@')[0], scope: 'full' };
  return null;
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const returnTo = url.searchParams.get('return') || '/partners/';

  if (!email) {
    return Response.redirect(`${url.origin}/access.html?error=no_email`, 302);
  }

  const known = getKnownUser(email);
  if (!known) {
    return Response.redirect(`${url.origin}/access.html?error=unknown&return=${encodeURIComponent(returnTo)}`, 302);
  }

  const session = JSON.stringify({
    email: email,
    name: known.name,
    approved: true,
    scope: known.scope,
    fullAccess: known.scope === 'full',
    at: new Date().toISOString(),
  });

  const maxAge = 60 * 60 * 24 * 30; // 30 days
  const cookie = `dev_access=${btoa(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': returnTo,
      'Set-Cookie': cookie,
    },
  });
}
