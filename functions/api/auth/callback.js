// GET /api/auth/callback — GitHub OAuth callback
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return Response.redirect(`${env.SITE_URL}/?error=no_code`, 302);
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_REDIRECT_URI,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    return Response.redirect(`${env.SITE_URL}/?error=auth_failed`, 302);
  }

  // Get user profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': '2nth-developers',
    },
  });
  const user = await userRes.json();

  const session = JSON.stringify({
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url,
    id: user.id,
  });

  const sessionB64 = btoa(session);
  const maxAge = 60 * 60 * 24 * 7;

  // Set two cookies:
  // dev_session (HttpOnly) — for server-side API validation
  // dev_user (JS-readable) — for client-side UI rendering
  const headers = new Headers({ Location: `${env.SITE_URL}/portal.html` });
  headers.append('Set-Cookie', `dev_session=${sessionB64}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  headers.append('Set-Cookie', `dev_user=${sessionB64}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  // Also store the access token for idea submission
  headers.append('Set-Cookie', `dev_gh_token=${tokenData.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);

  return new Response(null, { status: 302, headers });
}
