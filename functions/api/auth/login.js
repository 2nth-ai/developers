// GET /api/auth/login — redirect to partner hub sign-in page
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  return Response.redirect(`${url.origin}/access.html`, 302);
}
