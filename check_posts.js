const postgres = require('postgres');
const sql = postgres('postgresql://postgres.qpuoctixqpddxecurstq:Proxy-press%402026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres');
sql`SELECT * FROM posts ORDER BY published_at DESC LIMIT 1`.then(res => {
  console.log('Latest post:', res[0]);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
