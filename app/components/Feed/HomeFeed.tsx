'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Category, Post } from '@/lib/data';
import PostCard from './PostCard';
import CategoryFilters from './CategoryFilters';
import { getInitialData, getCurrentUser } from '@/lib/actions';

export default function HomeFeed() {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [data, user] = await Promise.all([
          getInitialData(),
          getCurrentUser()
        ]);
        
        if (data.posts) {
          const adaptedPosts = data.posts.map((p: any) => ({
            ...p,
            timeAgo: p.publishedAt ? formatTimeAgo(p.publishedAt) : 'Recently',
            isLiked: Array.isArray(p.likesList) ? p.likesList.some((l: any) => l.userId === user?.id) : false,
          }));
          setPosts(adaptedPosts);
        }
      } catch (err) {
        console.error('Failed to load posts from DB:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredPosts = useMemo(() => {
    if (activeCategory === 'All') return posts;
    return posts.filter(post => post.category === activeCategory);
  }, [activeCategory, posts]);

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
        
        {!isLoading && filteredPosts.length === 0 && (
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
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-subtle)', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className="spinner" />
            Connecting to database...
          </div>
        </div>
      ) : filteredPosts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '4px 0 0', color: 'var(--text-subtle)', fontSize: '13px' }}>
          Showing {filteredPosts.length} posts from local database
        </div>
      )}
    </div>
  );
}


function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
