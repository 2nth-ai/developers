// GET /api/auth/logout — clear cookie and redirect to home
export async function onRequestGet(context) {
  const { env } = context;
  return new Response(null, {
    status: 302,
    headers: {
      Location: env.SITE_URL || '/',
      'Set-Cookie': 'dev_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
