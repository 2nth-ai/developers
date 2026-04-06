// Luthuli Lodge — Database helpers, schema, and seed data

export function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'Direct',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  source TEXT DEFAULT 'Direct',
  arrive TEXT NOT NULL,
  depart TEXT NOT NULL,
  adults INTEGER DEFAULT 2,
  children INTEGER DEFAULT 0,
  pavilion TEXT,
  guide TEXT,
  base_rate REAL DEFAULT 0,
  status TEXT DEFAULT 'Confirmed',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (guest_id) REFERENCES guests(id)
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'host',
  email TEXT,
  phone TEXT,
  rotation_start TEXT,
  annual_leave_days INTEGER DEFAULT 21,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS staff_overrides (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  status TEXT DEFAULT 'Pending',
  reason TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  intent TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS managers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  code TEXT NOT NULL,
  channel TEXT,
  verified INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_log (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  actor TEXT,
  channel TEXT,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

const SEED_CHECK = `SELECT COUNT(*) as c FROM guests`;

const SEED = [
  // Guests
  `INSERT OR IGNORE INTO guests (id, name, email, phone, source) VALUES ('g_hamlin', 'Hamlin Family', 'hamlin@luthuli.test', '+27820000001', 'Owner')`,
  `INSERT OR IGNORE INTO guests (id, name, email, phone, source) VALUES ('g_vdmerwe', 'Van der Merwe', 'vdmerwe@example.com', '+27820000002', 'Direct')`,
  `INSERT OR IGNORE INTO guests (id, name, email, phone, source) VALUES ('g_ndlovu', 'Ndlovu & Party', 'ndlovu@example.com', '+27820000003', 'Perfect Hideaways')`,
  `INSERT OR IGNORE INTO guests (id, name, email, phone, source) VALUES ('g_thompson', 'Thompson', 'thompson@example.com', '+27820000004', 'Direct')`,
  `INSERT OR IGNORE INTO guests (id, name, email, phone, source) VALUES ('g_birding', 'Birding SA Group', 'info@birdingsa.co.za', '+27820000005', 'Direct')`,

  // Bookings — April 2026
  `INSERT OR IGNORE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_hamlin', 'g_hamlin', 'Owner', '2026-04-02', '2026-04-08', 2, 2, 'River Pavilion', 'Thabo', 0, 'Confirmed', 'Owner stay — no charge')`,
  `INSERT OR IGNORE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_vdmerwe', 'g_vdmerwe', 'Direct', '2026-04-06', '2026-04-10', 2, 0, 'Bush Pavilion', 'Sipho', 2800, 'Confirmed', NULL)`,
  `INSERT OR IGNORE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_ndlovu', 'g_ndlovu', 'Perfect Hideaways', '2026-04-12', '2026-04-15', 4, 0, 'Sunset Pavilion', 'Thabo', 4200, 'Confirmed', 'PH booking — 20% commission')`,
  `INSERT OR IGNORE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_thompson', 'g_thompson', 'Direct', '2026-04-18', '2026-04-21', 2, 1, 'Bush Pavilion', 'Sipho', 2800, 'Pending', 'Awaiting deposit')`,
  `INSERT OR IGNORE INTO bookings (id, guest_id, source, arrive, depart, adults, children, pavilion, guide, base_rate, status, notes) VALUES ('b_birding', 'g_birding', 'Direct', '2026-04-25', '2026-04-28', 6, 0, 'River Pavilion', 'External', 6500, 'Confirmed', 'Birding group — external guide')`,

  // Staff
  `INSERT OR IGNORE INTO staff (id, name, role, email, phone, rotation_start, annual_leave_days, active) VALUES ('s_nomsa', 'Nomsa', 'housekeeper', 'nomsa@luthuli.test', '+27830000001', '2026-03-01', 15, 1)`,
  `INSERT OR IGNORE INTO staff (id, name, role, email, phone, rotation_start, annual_leave_days, active) VALUES ('s_thandiwe', 'Thandiwe', 'housekeeper', 'thandiwe@luthuli.test', '+27830000002', '2026-03-22', 15, 1)`,

  // Managers — auto-enrolled admins
  `INSERT OR IGNORE INTO managers (id, name, email, role) VALUES ('m_craig', 'Craig Leppan', 'craig@b2bs.co.za', 'admin')`,
  `INSERT OR IGNORE INTO managers (id, name, email, role) VALUES ('m_guy', 'Guy Hamlin', 'guy@rumf.co.za', 'admin')`,
];

let initialized = false;

export async function initDB(db) {
  if (initialized) return;
  try {
    // Run schema creation — split on semicolons and execute each statement
    const statements = SCHEMA.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const sql of statements) {
      await db.prepare(sql).run();
    }

    // Check if already seeded
    const { results } = await db.prepare(SEED_CHECK).all();
    if (results[0].c === 0) {
      for (const sql of SEED) {
        await db.prepare(sql).run();
      }
    }

    initialized = true;
  } catch (e) {
    console.error('initDB error:', e);
    // Still mark initialized to avoid repeated failures
    initialized = true;
  }
}

export async function getBookingsForRange(db, start, end) {
  const { results } = await db.prepare(
    `SELECT b.*, g.name as guest_name, g.email as guest_email, g.phone as guest_phone
     FROM bookings b
     JOIN guests g ON b.guest_id = g.id
     WHERE b.arrive < ? AND b.depart > ?
     ORDER BY b.arrive`
  ).bind(end, start).all();
  return results;
}

export async function getStaffSchedule(db, staffId, start, end) {
  const staff = await db.prepare(`SELECT * FROM staff WHERE id = ?`).bind(staffId).first();
  if (!staff) return null;

  const { results: overrides } = await db.prepare(
    `SELECT * FROM staff_overrides WHERE staff_id = ? AND date >= ? AND date <= ? ORDER BY date`
  ).bind(staffId, start, end).all();

  const { results: leaveRequests } = await db.prepare(
    `SELECT * FROM staff_leave_requests WHERE staff_id = ? AND start_date <= ? AND end_date >= ? ORDER BY start_date`
  ).bind(staffId, end, start).all();

  return { staff, overrides, leaveRequests };
}
