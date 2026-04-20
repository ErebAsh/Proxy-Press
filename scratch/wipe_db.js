const sqlite = require('better-sqlite3');
const path = require('path');
const db = new sqlite(path.join(process.cwd(), 'sqlite.db'));

const tables = [
  'posts', 'post_likes', 'post_comments', 'post_saves',
  'messages', 'conversations', 'conversation_participants',
  'stories', 'story_slides',
  'notifications', 'follows', 'announcements', 'trending_topics',
  'user_blocks', 'user_mutes', 'user_reports', 'comment_likes',
  'users'
];

try {
  console.log('--- Starting Database Wipe ---');
  db.prepare('PRAGMA foreign_keys = OFF').run();
  
  // Find recent user first
  const recentUser = db.prepare("SELECT id, name FROM users WHERE id LIKE 'u1%' ORDER BY id DESC LIMIT 1").get();

  db.transaction(() => {
    for (const table of tables) {
      try {
        if (table === 'users') {
          if (recentUser) {
             db.prepare("DELETE FROM users WHERE id != ?").run(recentUser.id);
             console.log(`✅ Kept user ${recentUser.name} (${recentUser.id}), deleted all others.`);
          } else {
             db.prepare("DELETE FROM users").run();
             console.log('✅ Deleted ALL users.');
          }
        } else {
          db.prepare(`DELETE FROM ${table}`).run();
          console.log(`✅ Cleared ${table}`);
        }
      } catch (err) {
        console.warn(`⚠️ Table ${table} failed: ${err.message}`);
      }
    }
  })();
  
  db.prepare('PRAGMA foreign_keys = ON').run();
  console.log('--- Database Wipe Complete ---');
} catch (error) {
  console.error('❌ Wipe failed:', error.message);
} finally {
  db.close();
}
