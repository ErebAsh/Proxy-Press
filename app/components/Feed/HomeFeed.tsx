import { posts } from '@/lib/data';
import StoriesRow from './StoriesRow';
import PostCard from './PostCard';

export default function HomeFeed() {
  return (
    <div className="feed-container" id="home-feed">
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Your Feed
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Latest news &amp; updates from your college
        </p>
      </div>

      {/* Stories */}
      <StoriesRow />

      {/* Post feed */}
      <div id="posts-feed">
        {posts.map((post, idx) => (
          <PostCard key={post.id} post={post} index={idx} />
        ))}
      </div>

      {/* Load more indicator */}
      <div style={{ textAlign: 'center', padding: '32px 0 16px', color: 'var(--text-subtle)', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div className="spinner" />
          Loading more posts...
        </div>
      </div>
    </div>
  );
}
