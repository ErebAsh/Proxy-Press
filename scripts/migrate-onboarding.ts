import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

console.log('Running onboarding migration...');

// Add new columns (SQLite requires individual ALTER TABLE statements)
const columns = [
  { name: 'username', sql: "ALTER TABLE users ADD COLUMN username TEXT UNIQUE" },
  { name: 'date_of_birth', sql: "ALTER TABLE users ADD COLUMN date_of_birth TEXT" },
  { name: 'gender', sql: "ALTER TABLE users ADD COLUMN gender TEXT" },
  { name: 'links', sql: "ALTER TABLE users ADD COLUMN links TEXT" },
  { name: 'phone', sql: "ALTER TABLE users ADD COLUMN phone TEXT" },
  { name: 'profile_picture', sql: "ALTER TABLE users ADD COLUMN profile_picture TEXT" },
  { name: 'onboarding_complete', sql: "ALTER TABLE users ADD COLUMN onboarding_complete INTEGER DEFAULT 0" },
];

for (const col of columns) {
  try {
    db.exec(col.sql);
    console.log(`  ✓ Added column: ${col.name}`);
  } catch (err: any) {
    if (err.message.includes('duplicate column')) {
      console.log(`  ⊘ Column already exists: ${col.name}`);
    } else {
      throw err;
    }
  }
}

// Mark all existing users as onboarding-complete so they don't get redirected
db.exec("UPDATE users SET onboarding_complete = 1 WHERE onboarding_complete IS NULL OR onboarding_complete = 0");
console.log('  ✓ Marked existing users as onboarding-complete');

console.log('Migration complete!');
db.close();
