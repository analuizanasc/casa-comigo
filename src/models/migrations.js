const db = require('../config/database');

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS houses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      tolerance_percentage INTEGER NOT NULL DEFAULT 10,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS house_members (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('admin', 'catalog_manager', 'resident')) DEFAULT 'resident',
      weight_percentage REAL,
      weekly_availability_hours REAL NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(house_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_catalog (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','biweekly','monthly','quarterly','annual')),
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      effort_level TEXT NOT NULL CHECK(effort_level IN ('light','medium','heavy')),
      room TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES task_catalog(id) ON DELETE CASCADE,
      depends_on_task_id TEXT NOT NULL REFERENCES task_catalog(id) ON DELETE CASCADE,
      UNIQUE(task_id, depends_on_task_id)
    );

    CREATE TABLE IF NOT EXISTS member_preferences (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES task_catalog(id) ON DELETE CASCADE,
      preference_level TEXT NOT NULL CHECK(preference_level IN ('hate','neutral','like')) DEFAULT 'neutral',
      has_physical_limitation INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(house_id, user_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS task_assignments (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES task_catalog(id),
      assigned_to TEXT NOT NULL REFERENCES users(id),
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','completed','overdue','redistributed')) DEFAULT 'pending',
      completed_at TEXT,
      completion_notes TEXT,
      group_id TEXT,
      sequence_order INTEGER DEFAULT 0,
      distribution_period TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_assignments_house_date ON task_assignments(house_id, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_assignments_user ON task_assignments(assigned_to, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_assignments_status ON task_assignments(house_id, status);
  `);
}

module.exports = { runMigrations };
