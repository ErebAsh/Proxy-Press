const { getInitialData } = require('./lib/actions');
getInitialData('u1778616763553').then(res => {
  console.log('Posts count:', res.posts.length);
  console.log('First post ID:', res.posts[0]?.id);
  process.exit(0);
}).catch(console.error);
