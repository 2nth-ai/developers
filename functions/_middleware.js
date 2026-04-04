// Middleware: protect /partners/* /preview/* /hub*, inject user bar
const PROTECTED_PREFIXES = ['/partners/', '/preview/', '/hub', '/admin'];
const PUBLIC_PATHS = ['/access', '/api/', '/style.css', '/favicon', '/_headers', '/_redirects', '/docs', '/portal'];

function getSession(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/dev_access=([^\s;]+)/);
  if (!match) return null;
  try {
    const session = JSON.parse(atob(match[1]));
    if (session.email && session.approved) return session;
  } catch {}
  return null;
}

function hasAccess(session, path) {
  if (!session) return false;
  if (path.startsWith('/admin') && session.scope !== 'full' && !session.fullAccess) return false;
  if (session.scope === 'full' || session.fullAccess) return true;
  if (path.startsWith('/hub')) return true;
  if (path.startsWith('/docs') || path.startsWith('/portal')) return true;
  if (session.scope) {
    const scopes = session.scope.split(',').map(s => s.trim());
    return scopes.some(s => path.includes(s));
  }
  return false;
}

function canSeeGroup(groupScope, userScopes) {
  const gs = groupScope.split(',').map(s => s.trim());
  return gs.some(g => {
    if (g === 'platform') return true;
    if (g === 'imbila' || g === 'imbila,platform') return true;
    if (g === 'admin') return false;
    return userScopes.includes(g);
  });
}

function filterHubGroups(html, scope) {
  if (scope === 'full') return html;
  const userScopes = scope ? scope.split(',').map(s => s.trim()) : [];

  // Find each <div class="group" data-scope="..."> and its matching </div>
  const groupRe = /<div class="group" data-scope="([^"]*)">/g;
  let match;
  const removals = [];

  while ((match = groupRe.exec(html)) !== null) {
    const groupScope = match[1];
    if (canSeeGroup(groupScope, userScopes)) continue;

    // Find the matching closing </div> by counting depth
    const startIdx = match.index;
    let depth = 0;
    let i = startIdx;
    let endIdx = -1;

    while (i < html.length) {
      if (html.substr(i, 4) === '<div') {
        depth++;
        i += 4;
      } else if (html.substr(i, 6) === '</div>') {
        depth--;
        if (depth === 0) {
          endIdx = i + 6;
          break;
        }
        i += 6;
      } else {
        i++;
      }
    }

    if (endIdx > startIdx) {
      removals.push([startIdx, endIdx]);
    }
  }

  // Remove from end to start so indices stay valid
  for (let r = removals.length - 1; r >= 0; r--) {
    html = html.slice(0, removals[r][0]) + html.slice(removals[r][1]);
  }

  return html;
}

const USER_BAR = (name, scope) => `
<div id="2nth-user-bar" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#18181b;border-top:1px solid #27272a;padding:6px 16px;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,sans-serif;font-size:11px">
<div style="display:flex;align-items:center;gap:8px">
<div style="width:6px;height:6px;border-radius:50%;background:#22c55e"></div>
<span style="color:#a1a1aa">${name}</span>
<span style="color:#52525b">&middot;</span>
<span style="color:#52525b">${scope === 'full' ? 'Admin' : scope}</span>
</div>
<a href="/api/access-logout" style="color:#71717a;text-decoration:none;font-size:10px;letter-spacing:1px;text-transform:uppercase">Sign out</a>
</div>
<style>body{padding-bottom:32px}</style>`;

const SCOPE_SCRIPT = (scope) => `<script>window.__userScope='${scope}';</script>`;

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return next();

  const isProtected = PROTECTED_PREFIXES.some(p => path.startsWith(p));
  if (!isProtected) return next();

  const session = getSession(request);

  if (!session) {
    return Response.redirect(`${url.origin}/access.html?return=${encodeURIComponent(path)}`, 302);
  }

  if (!hasAccess(session, path)) {
    return Response.redirect(`${url.origin}/access.html?error=scope&return=${encodeURIComponent(path)}`, 302);
  }

  const response = await next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  // Server-side: strip hub groups the user shouldn't see
  if (path.startsWith('/hub') && session.scope !== 'full' && !session.fullAccess) {
    html = filterHubGroups(html, session.scope);
  }

  const bar = USER_BAR(session.name, session.scope);
  const scopeTag = SCOPE_SCRIPT(session.scope);
  const injected = html.replace('</body>', bar + scopeTag + '</body>');

  return new Response(injected, {
    status: response.status,
    headers: response.headers,
  });
}
