import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

console.log('Running safety features migration...');

const tables = [
  {
    name: 'user_blocks',
    sql: `CREATE TABLE IF NOT EXISTS user_blocks (
      user_id TEXT NOT NULL REFERENCES users(id),
      blocked_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, blocked_id)
    )`,
  },
  {
    name: 'user_mutes',
    sql: `CREATE TABLE IF NOT EXISTS user_mutes (
      user_id TEXT NOT NULL REFERENCES users(id),
      muted_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, muted_id)
    )`,
  },
  {
    name: 'user_reports',
    sql: `CREATE TABLE IF NOT EXISTS user_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id),
      target_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  },
];

for (const table of tables) {
  try {
    db.exec(table.sql);
    console.log(`  ✓ Created table: ${table.name}`);
  } catch (err: any) {
    console.error(`  ✗ Error creating ${table.name}:`, err.message);
  }
}

console.log('Safety migration complete!');
db.close();
