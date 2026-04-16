'use client';

import { useState, useMemo } from 'react';
import { posts } from '@/lib/data';
import type { Category } from '@/lib/data';
import PostCard from './PostCard';
import CategoryFilters from './CategoryFilters';

export default function HomeFeed() {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');

  const filteredPosts = useMemo(() => {
    if (activeCategory === 'All') return posts;
    return posts.filter(post => post.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="feed-container" id="home-feed">
      {/* Category filters replaced StoriesRow */}
      <CategoryFilters 
        activeCategory={activeCategory} 
        onCategoryChange={setActiveCategory} 
      />

      {/* Post feed */}
      <div id="posts-feed">
        {filteredPosts.map((post, idx) => (
          <PostCard key={post.id} post={post} index={idx} />
        ))}
        
        {filteredPosts.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px', 
            color: 'var(--text-muted)' 
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📭</div>
            <p style={{ fontWeight: 600 }}>No posts found in this category</p>
          </div>
        )}
      </div>

      {/* Load more indicator */}
      {filteredPosts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '4px 0 0', color: 'var(--text-subtle)', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className="spinner" />
            Loading more posts...
          </div>
        </div>
      )}
    </div>
  );
}
