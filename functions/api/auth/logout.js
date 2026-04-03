// GET /api/auth/logout — clear all cookies and redirect home
export async function onRequestGet(context) {
  const { env } = context;
  const headers = new Headers({ Location: env.SITE_URL || '/' });
  headers.append('Set-Cookie', 'dev_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  headers.append('Set-Cookie', 'dev_user=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  headers.append('Set-Cookie', 'dev_gh_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 302, headers });
}
