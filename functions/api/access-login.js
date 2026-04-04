// GET /api/access-login?token=...&return=... — magic link login for approved users
// Sets the dev_access cookie and redirects to the requested page

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const returnTo = url.searchParams.get('return') || '/partners/';

  if (!token) {
    return Response.redirect(`${url.origin}/access.html?error=missing_token`, 302);
  }

  try {
    const session = JSON.parse(atob(decodeURIComponent(token)));
    if (!session.email || !session.approved) {
      return Response.redirect(`${url.origin}/access.html?error=invalid`, 302);
    }

    const maxAge = 60 * 60 * 24 * 30; // 30 days
    const headers = new Headers({
      Location: `${url.origin}${returnTo}`,
    });
    headers.append('Set-Cookie', `dev_access=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);

    return new Response(null, { status: 302, headers });

  } catch {
    return Response.redirect(`${url.origin}/access.html?error=invalid`, 302);
  }
}
