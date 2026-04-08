// GET /api/auth/logout — clear session and redirect home

export async function onRequestGet(context) {
  const { request, env } = context;

  // Delete OTP session from KV
  const cookie = request.headers.get('Cookie') || '';
  const sidMatch = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if (sidMatch && env.KV) {
    await env.KV.delete(`session:${sidMatch[1]}`).catch(() => {});
  }

  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  headers.append('Set-Cookie', 'pps=; Path=/partners; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 302, headers });
}
