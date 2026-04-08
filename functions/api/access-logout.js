// GET /api/access-logout — clear session and redirect to hub
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const headers = new Headers({ Location: `${url.origin}/hub.html` });
  headers.append('Set-Cookie', 'dev_access=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 302, headers });
}
