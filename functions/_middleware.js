// Middleware: protect /partners/* and /preview/* routes
// Sign-in uses GET redirect to /api/access-signin (sets cookie via 302)
const PROTECTED_PREFIXES = ['/partners/', '/preview/'];
const PUBLIC_PATHS = ['/access', '/api/', '/style.css', '/favicon', '/_headers', '/_redirects', '/hub'];

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return next();

  const isProtected = PROTECTED_PREFIXES.some(p => path.startsWith(p));
  if (!isProtected) return next();

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/dev_access=([^\s;]+)/);

  if (match) {
    try {
      const session = JSON.parse(atob(match[1]));
      if (session.email && session.approved) {
        if (session.scope === 'full' || session.fullAccess) return next();
        if (session.scope) {
          const scopes = session.scope.split(',');
          if (scopes.some(s => path.includes(s))) return next();
          return Response.redirect(`${url.origin}/access.html?error=scope&return=${encodeURIComponent(path)}`, 302);
        }
        return next();
      }
    } catch {}
  }

  return Response.redirect(`${url.origin}/access.html?return=${encodeURIComponent(path)}`, 302);
}
