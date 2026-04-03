// GET /api/auth/callback — GitHub OAuth callback
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

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

  // Build a simple session cookie with user info (not the token itself)
  const session = JSON.stringify({
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url,
    id: user.id,
  });

  const sessionB64 = btoa(session);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${env.SITE_URL}/portal.html`,
      'Set-Cookie': `dev_session=${sessionB64}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
    },
  });
}
