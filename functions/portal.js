// GET /portal — serves portal.html with session data injected server-side
// This avoids client-side fetch calls that get blocked by Bot Fight Mode

export async function onRequestGet(context) {
  const { request, env } = context;

  // Read session from cookie
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/dev_session=([^\s;]+)/);

  let userData = 'null';
  if (match) {
    try {
      const decoded = atob(match[1]);
      // Validate it's proper JSON before injecting
      JSON.parse(decoded);
      userData = decoded;
    } catch { /* invalid session, treat as logged out */ }
  }

  // Fetch the static HTML
  const asset = await env.ASSETS.fetch(new Request(new URL('/portal.html', request.url)));
  let html = await asset.text();

  // Inject session data as a script tag before the closing </head>
  const injection = `<script>window.__DEV_SESSION = ${userData};</script>`;
  html = html.replace('</head>', injection + '\n</head>');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      ...Object.fromEntries(asset.headers.entries()),
    },
  });
}
