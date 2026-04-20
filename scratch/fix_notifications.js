const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
  console.log('Adding "created_at" column to "notifications" table...');
  db.prepare("ALTER TABLE notifications ADD COLUMN created_at TEXT NOT NULL DEFAULT '" + new Date().toISOString() + "'").run();
  console.log('Successfully added "created_at" column.');
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('Column "created_at" already exists.');
  } else {
    console.error('Error adding column:', err.message);
  }
} finally {
  db.close();
}
