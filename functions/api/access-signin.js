// GET /api/access-signin?id=...&code=...&return=... — sign in with ID + PIN
// Reads users from KV (SESSIONS namespace), falls back to hardcoded during migration
import { createSession, setSessionCookie, setSessionCookieLocal, isAdminEmail } from '../lib/jwt.js';

// Hardcoded fallback — will be removed once KV is confirmed working
const FALLBACK_USERS = {
  'craig':    { id:'craig', email: 'craig@2nth.ai',         name: 'Craig Leppan',  scope: 'full',                    pin: '3325' },
  'craig-pg': { id:'craig-pg', email: 'craig@proximity.green', name: 'Craig Leppan',  scope: 'proximity-green,luthuli', pin: '3325' },
  'mark':     { id:'mark', email: 'mark@proximity.green',  name: 'Mark',          scope: 'proximity-green',         pin: '7746' },
  'guy':      { id:'guy', email: 'guy@rumf.co.za',        name: 'Guy Hamlin',    scope: 'full',                     pin: '5591' },
  'jasper':   { id:'jasper', email: 'jasper@dronescan.co',  name: 'Jasper',        scope: 'dronescan,scanman,luthuli', pin: '3847' },
  'craig-b2b':{ id:'craig-b2b', email: 'craig@b2bs.co.za',   name: 'Craig Leppan',  scope: 'full',                    pin: '3325' },
  'kath':     { id:'kath', email: 'kath@ctrlfuture.co.za', name: 'Katherine Janisch', scope: 'ctrl-future',          pin: '4418' },
  'republic': { id:'republic', email: 'info@republiclifestyle.co.za', name: 'Republic Lifestyle', scope: 'republic-lifestyle', pin: '1971' },
  'emma':     { id:'emma', email: 'emma@vibecrafters.com',       name: 'Emma Leppan',         scope: 'vibecrafters',         pin: '0902' },
  'barry':    { id:'barry', email: 'barry@gananda.net',           name: 'Barry Hawke',          scope: 'full',                 pin: '5233' },
  'jacqui':   { id:'jacqui', email: 'jacqui.denny@durpro.co.za',  name: 'Jacqui Denny',         scope: 'durpro',               pin: '1992' },
  'murray':   { id:'murray', email: 'murray@dronescan.co',        name: 'Murray Paton',         scope: 'dronescan',            pin: '4471' },
  'brian':    { id:'brian', email: 'brian.denny@deneys.co.za',  name: 'Brian Denny',          scope: 'durpro',               pin: '7741' },
  'barryr':   { id:'barryr', email: 'barry.rohrs@rohrsassociates.com', name: 'Barry Röhrs',    scope: 'rohrs',                pin: '2026' },
};

async function getUser(env, id) {
  // Try KV first
  if (env.SESSIONS) {
    try {
      const data = await env.SESSIONS.get(`user:${id}`, 'json');
      if (data && data.active !== false) return data;
    } catch {}
  }
  // Fallback to hardcoded
  return FALLBACK_USERS[id] || null;
}

async function getUserByEmail(env, email) {
  // Try KV reverse lookup
  if (env.SESSIONS) {
    try {
      const userId = await env.SESSIONS.get(`user-email:${email}`);
      if (userId) {
        const data = await env.SESSIONS.get(`user:${userId}`, 'json');
        if (data && data.active !== false) return data;
      }
    } catch {}
  }
  // Fallback to hardcoded
  return Object.values(FALLBACK_USERS).find(u => u.email === email) || null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const code = (url.searchParams.get('code') || '').trim();
  const returnTo = url.searchParams.get('return') || '/hub.html';
  const isPagesDev = url.hostname.includes('.pages.dev');

  // Legacy support: email param for direct sign-in links
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (email) {
    const user = await getUserByEmail(env, email);
    if (!user) return Response.redirect(`${url.origin}/access.html?error=unknown&return=${encodeURIComponent(returnTo)}`, 302);
    return mintAndRedirect(env, user, returnTo, isPagesDev);
  }

  if (!id) {
    return Response.redirect(`${url.origin}/access.html?error=missing&return=${encodeURIComponent(returnTo)}`, 302);
  }

  const user = await getUser(env, id);
  if (!user) {
    return Response.redirect(`${url.origin}/access.html?error=unknown&return=${encodeURIComponent(returnTo)}`, 302);
  }

  if (code !== (user.pin || user.code)) {
    return Response.redirect(`${url.origin}/access.html?error=code&return=${encodeURIComponent(returnTo)}`, 302);
  }

  return mintAndRedirect(env, user, returnTo, isPagesDev);
}

async function mintAndRedirect(env, user, returnTo, isPagesDev) {
  // If JWT_SECRET is available, mint a proper JWT
  if (env.JWT_SECRET) {
    const token = await createSession(env, user);
    const cookie = isPagesDev ? setSessionCookieLocal(token) : setSessionCookie(token);

    // Also set legacy cookie during migration so old middleware still works
    const legacySession = JSON.stringify({
      email: user.email, name: user.name, approved: true,
      scope: user.scope, fullAccess: user.scope === 'full',
      at: new Date().toISOString(),
    });
    const legacyCookie = `dev_access=${btoa(legacySession)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;

    const headers = new Headers({ 'Location': returnTo });
    headers.append('Set-Cookie', cookie);
    headers.append('Set-Cookie', legacyCookie);
    return new Response(null, { status: 302, headers });
  }

  // Fallback: legacy cookie only (no JWT_SECRET configured)
  const session = JSON.stringify({
    email: user.email, name: user.name, approved: true,
    scope: user.scope, fullAccess: user.scope === 'full',
    at: new Date().toISOString(),
  });
  return new Response(null, {
    status: 302,
    headers: {
      'Location': returnTo,
      'Set-Cookie': `dev_access=${btoa(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
    },
  });
}
