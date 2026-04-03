// GET /api/auth/session — return current user from cookie
export async function onRequestGet(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/dev_session=([^\s;]+)/);
  if (!match) return Response.json({ user: null });

  try {
    const user = JSON.parse(atob(match[1]));
    return Response.json({ user });
  } catch {
    return Response.json({ user: null });
  }
}
