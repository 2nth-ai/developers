// ═══════════════════════════════════════════════════════════════════
// functions/lib/registry.js — single source of truth for all partner
// and access-control data. Import this everywhere; never duplicate it.
//
// To add a partner:
//   1. Add an entry to PARTNER_REGISTRY
//   2. If it's an individual (not an org), add the key to INDIVIDUAL_PARTNERS
//   3. If a page slug differs from the partner key, add to PAGE_KEY_MAP
//   That's it — middleware, invite, and visibility all derive from here.
// ═══════════════════════════════════════════════════════════════════

export const PARTNER_REGISTRY = {
  // ── Organisations ───────────────────────────────────────────────
  'andile':          { owners: ['albert@andilesolutions.com','neil@andilesolutions.com','craigl@andilesolutions.com'] },
  'vibecrafters':    { owners: ['hello@vibecrafters.co.za','vibecrafterza@gmail.com'] },
  'agilex':          { owners: ['michael@agilex.co.za'] },
  'gridlineprop':    { owners: ['info@gridlineprop.co.za'] },
  'scanman':         { owners: ['info@scanman.co.za'] },
  'proximity-green': { owners: ['info@proximity-green.co.za'] },
  'dronescan':       { owners: ['info@dronescan.co.za'] },
  '20crm':           { owners: ['craig@2nth.ai', 'craig@b2bs.co.za'] },

  // ── Individual build/consulting partners ────────────────────────
  // Individual pages default to PRIVATE — owner + admin only until
  // the partner sets visibility to 'partners' or 'all' themselves.
  'hyram':           { owners: ['hyramserretta20@gmail.com'] },
  'carla':           { owners: ['carladeabreu@outlook.com'] },
  'nicola':          { owners: ['nicola@gananda.net'] },
  'james-grant':     { owners: ['jamesgrant321@proton.me'] },
  'robert-fairon':   { owners: ['robert.fairon@daemon.com'] }, // update when email confirmed
  'kath-janisch':    { owners: ['kath@ctrlfuture.co.za'] },
};

// Individual partner keys — pages are private by default.
// Org pages (any key NOT in this set) default to visible to all authenticated partners.
export const INDIVIDUAL_PARTNERS = new Set([
  'hyram',
  'carla',
  'nicola',
  'james-grant',
  'robert-fairon',
  'kath-janisch',
]);

// Maps page slugs that differ from the partner key → partner key.
// Add here when a partner has sub-pages (e.g. andile-concept → andile).
export const PAGE_KEY_MAP = {
  'andile-concept':          'andile',
  'andile-copilot':          'andile',
  'andile-frtb':             'andile',
  'andile-sb-calypso':       'andile',
  'andile-sb-calypso-teams': 'andile',
  'agilex-paton-personnel':  'agilex',
  'agilex-walker-phillip':   'agilex',
};

// Emails that can see and manage everything.
export const ADMIN_EMAILS = [
  'craig@2nth.ai',
  'craigl@2nth.ai',
  'craig@b2bs.co.za',
  'imbilawork@gmail.com',
];

export const BLOCKED_EMAILS = ['leppan.craig@gmail.com'];

// ── Derived helpers ──────────────────────────────────────────────

/** All owner emails across every partner, as a Set. */
export const ALL_PARTNER_EMAILS = new Set(
  Object.values(PARTNER_REGISTRY).flatMap(p => p.owners)
);

/** Is this email a platform admin? */
export function isAdmin(email, role) {
  return ADMIN_EMAILS.includes(email) || role === 'admin';
}

/** Is this email a registered partner owner (of any partner)? */
export function isPartner(email) {
  return ALL_PARTNER_EMAILS.has(email);
}

/** Is this email an owner of the given partner key? */
export function isOwner(email, partnerKey) {
  return PARTNER_REGISTRY[partnerKey]?.owners.includes(email) ?? false;
}

/**
 * Resolve a /partners/<slug> path to its partner key.
 * Returns null if the slug doesn't match any known partner.
 */
export function resolvePartnerKey(path) {
  const slug = path
    .replace(/^\/partners\//, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '');

  if (!slug || slug === 'index') return null;
  if (PARTNER_REGISTRY[slug]) return slug;
  if (PAGE_KEY_MAP[slug]) return PAGE_KEY_MAP[slug];
  // Prefix match: andile-anything → andile
  for (const key of Object.keys(PARTNER_REGISTRY)) {
    if (slug.startsWith(key + '-')) return key;
  }
  return null;
}
