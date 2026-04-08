// ═══════════════════════════════════════════════════════════════════
// functions/lib/partners.js — KV-based partner lookup
//
// Single source of truth for partner data. The old PARTNER_REGISTRY
// in registry.js is kept for backward compat with existing static
// pages, but all new lookups go through here.
//
// KV schema:
//   partner:{key}          → PartnerRecord (see below)
//   partner_email:{email}  → {key}           (reverse lookup by email)
//
// PartnerRecord: {
//   key, name, email, emails[], company,
//   status: 'pending' | 'active' | 'suspended',
//   type:   'individual' | 'org',
//   visibility: 'private' | 'partners' | 'public',
//   profile: { bio, tagline, logo, website, services[], contact{} },
//   createdAt, approvedAt, approvedBy
// }
// ═══════════════════════════════════════════════════════════════════

import { PARTNER_REGISTRY, INDIVIDUAL_PARTNERS } from './registry.js';

// ── Helpers ──────────────────────────────────────────────────────

function staticToRecord(key) {
  const entry = PARTNER_REGISTRY[key];
  if (!entry) return null;
  return {
    key,
    email: entry.owners[0] || null,
    emails: entry.owners,
    name: key,
    company: key,
    status: 'active',
    type: INDIVIDUAL_PARTNERS.has(key) ? 'individual' : 'org',
    visibility: INDIVIDUAL_PARTNERS.has(key) ? 'private' : 'partners',
    profile: {},
    _source: 'static',
  };
}

// ── Core lookups ─────────────────────────────────────────────────

/** Get a partner record by key. Checks KV first, falls back to static registry. */
export async function getPartner(env, key) {
  if (!key) return null;
  if (env.KV) {
    try {
      const raw = await env.KV.get(`partner:${key}`);
      if (raw) {
        const record = JSON.parse(raw);
        if (record.status === 'active') return record;
        return null; // pending or suspended — not active
      }
    } catch { /* ignore */ }
  }
  return staticToRecord(key);
}

/** Get a partner record by owner email. KV reverse-lookup first, then scan static registry. */
export async function getPartnerByEmail(env, email) {
  if (!email) return null;
  const norm = email.toLowerCase();

  if (env.KV) {
    try {
      const raw = await env.KV.get(`partner_email:${norm}`);
      if (raw) {
        const { key } = JSON.parse(raw);
        if (key) return getPartner(env, key);
      }
    } catch { /* ignore */ }
  }

  // Fall back to static registry scan
  for (const [key, entry] of Object.entries(PARTNER_REGISTRY)) {
    if (entry.owners.some(o => o.toLowerCase() === norm)) {
      return staticToRecord(key);
    }
  }
  return null;
}

/** Returns true if this email belongs to any active partner. */
export async function isActivePartner(env, email) {
  if (!email) return false;
  const partner = await getPartnerByEmail(env, email);
  return partner !== null;
}

/** Resolve a /partners/<slug> path to the partner key, checking KV for dynamic partners. */
export async function resolvePartnerKey(env, path) {
  const slug = path
    .replace(/^\/partners\//, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '');

  if (!slug || slug === 'index') return null;

  // Static registry (direct match or sub-page prefix)
  if (PARTNER_REGISTRY[slug]) return slug;
  for (const [key] of Object.entries(PARTNER_REGISTRY)) {
    if (slug.startsWith(key + '-')) return key;
  }

  // Dynamic KV partner
  if (env.KV) {
    try {
      const raw = await env.KV.get(`partner:${slug}`);
      if (raw) {
        const record = JSON.parse(raw);
        if (record.status === 'active') return slug;
      }
    } catch { /* ignore */ }
  }
  return null;
}

/** Get all owners for a given partner key. */
export async function getOwners(env, key) {
  if (!key) return [];

  if (env.KV) {
    try {
      const raw = await env.KV.get(`partner:${key}`);
      if (raw) {
        const record = JSON.parse(raw);
        return record.emails || (record.email ? [record.email] : []);
      }
    } catch { /* ignore */ }
  }
  return PARTNER_REGISTRY[key]?.owners || [];
}

/** True if the email is an owner of the given partner key. */
export async function isOwner(env, email, key) {
  if (!email || !key) return false;
  const owners = await getOwners(env, key);
  return owners.some(o => o.toLowerCase() === email.toLowerCase());
}

// ── Registration ─────────────────────────────────────────────────

/**
 * Create a pending partner registration in KV.
 * Returns the new record.
 */
export async function createPendingPartner(env, { key, name, email, company, type = 'individual', message = '' }) {
  if (!env.KV) throw new Error('KV not available');

  const record = {
    key,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    emails: [email.toLowerCase().trim()],
    company: company.trim(),
    status: 'pending',
    type,
    visibility: type === 'individual' ? 'private' : 'partners',
    profile: { bio: message },
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
  };

  await env.KV.put(`partner:${key}`, JSON.stringify(record));
  await env.KV.put(`partner_email:${record.email}`, JSON.stringify({ key }));
  await env.KV.put(`partner_pending:${key}`, '1', { expirationTtl: 60 * 60 * 24 * 90 });

  return record;
}

/**
 * Approve a pending partner. Sets status=active, clears pending flag.
 */
export async function approvePartner(env, key, approvedBy) {
  if (!env.KV) throw new Error('KV not available');

  const raw = await env.KV.get(`partner:${key}`);
  if (!raw) throw new Error(`Partner "${key}" not found`);

  const record = JSON.parse(raw);
  record.status = 'active';
  record.approvedAt = new Date().toISOString();
  record.approvedBy = approvedBy;

  await env.KV.put(`partner:${key}`, JSON.stringify(record));
  await env.KV.delete(`partner_pending:${key}`);

  return record;
}

/**
 * Update a partner's profile fields (partner self-service).
 * Only allows updating safe fields — status and emails cannot be changed here.
 */
export async function updatePartnerProfile(env, key, updates) {
  if (!env.KV) throw new Error('KV not available');

  const raw = await env.KV.get(`partner:${key}`);
  if (!raw) throw new Error(`Partner "${key}" not found`);

  const record = JSON.parse(raw);

  // Safe fields only
  if (updates.name) record.name = updates.name.trim();
  if (updates.company) record.company = updates.company.trim();
  if (updates.visibility && ['private', 'partners', 'public'].includes(updates.visibility)) {
    record.visibility = updates.visibility;
  }
  if (updates.profile && typeof updates.profile === 'object') {
    record.profile = { ...record.profile, ...updates.profile };
  }
  record.updatedAt = new Date().toISOString();

  await env.KV.put(`partner:${key}`, JSON.stringify(record));
  return record;
}

/** List all pending partner registrations. */
export async function listPendingPartners(env) {
  if (!env.KV) return [];
  try {
    const list = await env.KV.list({ prefix: 'partner_pending:' });
    const records = await Promise.all(
      list.keys.map(async ({ name }) => {
        const key = name.replace('partner_pending:', '');
        const raw = await env.KV.get(`partner:${key}`);
        try { return raw ? JSON.parse(raw) : null; } catch { return null; }
      })
    );
    return records.filter(Boolean);
  } catch { return []; }
}
