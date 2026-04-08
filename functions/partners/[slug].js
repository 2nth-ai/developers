// Serves partner profile pages.
// Priority order:
//   1. KV-stored page (dynamically generated via /onboard) — served inline
//   2. Static .html file (manually built partners) — 301 redirect to slug.html
//   3. Neither found — redirect to partners index

import { PARTNER_REGISTRY, PAGE_KEY_MAP } from '../lib/registry.js';

function isStaticPartner(slug) {
  if (PARTNER_REGISTRY[slug]) return true;
  if (PAGE_KEY_MAP[slug]) return true;
  // prefix match
  for (const key of Object.keys(PARTNER_REGISTRY)) {
    if (slug.startsWith(key + '-')) return true;
  }
  return false;
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const slug = params.slug;

  if (!slug) return new Response('Not found', { status: 404 });

  // 1. Try KV (dynamically generated via onboard form)
  if (env.KV) {
    const html = await env.KV.get(`partner_page:${slug}`);
    if (html) {
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  // 2. Static partner — redirect to the .html file
  if (isStaticPartner(slug)) {
    return new Response(null, {
      status: 301,
      headers: { Location: `/partners/${slug}.html` },
    });
  }

  // 3. Unknown — back to index
  return new Response(null, {
    status: 302,
    headers: { Location: '/partners/index.html' },
  });
}
