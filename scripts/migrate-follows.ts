import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

console.log('Running follows migration...');

const tableSql = `
  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id),
    following_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_id, following_id)
  )
`;

try {
  db.exec(tableSql);
  console.log('  ✓ Created table: follows');
} catch (err: any) {
  console.error('  ✗ Error creating follows table:', err.message);
}

console.log('Follows migration complete!');
db.close();
