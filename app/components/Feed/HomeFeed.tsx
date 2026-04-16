import { posts } from '@/lib/data';
import StoriesRow from './StoriesRow';
import PostCard from './PostCard';

export default function HomeFeed() {
  return (
    <div className="feed-container" id="home-feed">
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
