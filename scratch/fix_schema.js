const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

function addColumnIfNotExists(table, column, type) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!info.find(c => c.name === column)) {
    console.log(`Adding column ${column} to ${table}...`);
    // SQLite doesn't support DEFAULT with complex expressions in ALTER TABLE easily, 
    // so we'll just add it as NULLABLE first or with a static default.
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    
    // Set a default value for existing rows
    const now = new Date().toISOString();
    db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} IS NULL`).run(now);
  } else {
    console.log(`Column ${column} already exists in ${table}.`);
  }
}

try {
  addColumnIfNotExists('story_slides', 'created_at', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('user_mutes', 'created_at', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('user_reports', 'created_at', "TEXT NOT NULL DEFAULT ''");
  
  // Sync users dob -> date_of_birth if needed
  console.log('Syncing data from dob to date_of_birth...');
  db.prepare(`UPDATE users SET date_of_birth = dob WHERE date_of_birth IS NULL AND dob IS NOT NULL`).run();
  
  // Set accurate current time for any empty strings
  const now = new Date().toISOString();
  db.prepare(`UPDATE story_slides SET created_at = ? WHERE created_at = ''`).run(now);
  db.prepare(`UPDATE user_mutes SET created_at = ? WHERE created_at = ''`).run(now);
  db.prepare(`UPDATE user_reports SET created_at = ? WHERE created_at = ''`).run(now);

  console.log('Migration successful!');
} catch (err) {
  console.error('Migration failed:', err);
} finally {
  db.close();
}
