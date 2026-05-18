'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Category, Post } from '@/lib/data';
import PostCard from './PostCard';
import CategoryFilters from './CategoryFilters';
import { getInitialData, getCurrentUser, getProfileData } from '@/lib/actions';
import { OfflineManager } from '@/lib/offline-manager';

let globalInMemoryPosts: any[] = [];
let globalInMemoryLoaded = false;

export default function HomeFeed() {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [posts, setPosts] = useState<any[]>(globalInMemoryPosts);
  const [isLoading, setIsLoading] = useState(!globalInMemoryLoaded);
  const cacheLoaded = useRef(false);
  const freshDataLoaded = useRef(false);

  useEffect(() => {
    async function loadCache() {
      if (cacheLoaded.current || freshDataLoaded.current) return;
      
      // 1. Try SQLite Global Feed first
      const offlineFeed = await OfflineManager.getOfflineHomeFeed();
      if (freshDataLoaded.current) return; // Abort if network finished first
      
      if (offlineFeed && offlineFeed.length > 0) {
        console.log('[Offline] SQLite Home Feed loaded');
        const adapted = offlineFeed.map((p: any) => ({
          ...p,
          imageUrl: p.localImageUrl || p.imageUrl,
          author: { name: p.authorName, avatar: p.authorAvatar },
          timeAgo: p.publishedAt ? formatTimeAgo(p.publishedAt) : 'Recently',
        }));
        setPosts(adapted);
        setIsLoading(false);
        globalInMemoryPosts = adapted;
        globalInMemoryLoaded = true;
        cacheLoaded.current = true;
        return;
      }

      // 2. Legacy Preferences Fallback
      if (freshDataLoaded.current) return;
      const cached = await OfflineManager.loadData<any>('home_feed_cache');
      if (cached && cached.posts && cached.posts.length > 0) {
        console.log('[Offline] Legacy cache load');
        setPosts(cached.posts);
        setIsLoading(false);
      }
      cacheLoaded.current = true;
    }

    loadCache();

    async function loadData() {
      try {
        const user = await getCurrentUser();
        const data = await getInitialData(user?.id);
        
        if (data.posts) {
          freshDataLoaded.current = true;
          const adaptedPosts = data.posts.map((p: any) => ({
            ...p,
            timeAgo: p.publishedAt ? formatTimeAgo(p.publishedAt) : 'Recently',
            isLiked: Array.isArray(p.likesList) ? p.likesList.some((l: any) => l.userId === user?.id) : false,
          }));
          setPosts(adaptedPosts);
          globalInMemoryPosts = adaptedPosts;
          globalInMemoryLoaded = true;
          
          // 2. Update cache with fresh data
          OfflineManager.saveData('home_feed_cache', {
            posts: adaptedPosts,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error('Failed to load posts from DB:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // ─── PULL TO REFRESH LOGIC ───
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStart = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStart.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const currentTouch = e.touches[0].clientY;
    const distance = currentTouch - touchStart.current;

    if (distance > 0 && window.scrollY === 0) {
      // Add resistance to the pull
      const dampenedDistance = Math.min(distance * 0.4, 80);
      setPullDistance(dampenedDistance);
      if (dampenedDistance > 10) {
        if (e.cancelable) e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance > 60) {
      await performRefresh();
    }
    setPullDistance(0);
  };

  const performRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Sync from server to SQLite
      await OfflineManager.syncHomeFeed();
      
      // 2. Load the fresh data from SQLite
      const freshData = await OfflineManager.getOfflineHomeFeed();
      if (freshData && freshData.length > 0) {
        const adapted = freshData.map((p: any) => ({
          ...p,
          imageUrl: p.localImageUrl || p.imageUrl,
          author: { name: p.authorName, avatar: p.authorAvatar },
          timeAgo: p.publishedAt ? formatTimeAgo(p.publishedAt) : 'Recently',
        }));
        setPosts(adapted);
      }
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };



  const filteredPosts = useMemo(() => {
    if (activeCategory === 'All') return posts;
    return posts.filter(post => post.category === activeCategory);
  }, [activeCategory, posts]);

  // Split into hero (first post with image) and rest
  const heroPost = filteredPosts.length > 0 && filteredPosts[0].imageUrl
    ? filteredPosts[0]
    : null;
  const remainingPosts = heroPost
    ? filteredPosts.slice(1)
    : filteredPosts;

  return (
    <div 
      className="feed-container has-mobile-header" 
      id="home-feed"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'
      }}
    >
      {/* Pull indicator */}
      <div style={{
        position: 'absolute',
        top: -40,
        left: 0,
        right: 0,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pullDistance / 60,
        color: 'var(--primary)',
        fontSize: '12px',
        fontWeight: 600,
        gap: '8px'
      }}>
        <div className={`spinner ${isRefreshing ? '' : 'paused'}`} style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
        {isRefreshing ? 'Updating...' : 'Pull to update'}
      </div>

      {/* Category filters */}
      <CategoryFilters 
        activeCategory={activeCategory} 
        onCategoryChange={setActiveCategory} 
      />

      {/* News feed */}
      <div id="posts-feed" style={{ paddingTop: '4px' }}>
        {/* Hero card */}
        {heroPost && (
          <PostCard key={heroPost.id} post={heroPost} index={0} variant="hero" />
        )}

        {/* Section header for remaining posts */}
        {remainingPosts.length > 0 && (
          <div className="news-section-header">
            <span className="news-section-title">
              {activeCategory === 'All' ? 'Latest' : activeCategory}
            </span>
            <span className="news-section-count">
              {remainingPosts.length} {remainingPosts.length === 1 ? 'story' : 'stories'}
            </span>
          </div>
        )}

        {/* Compact list */}
        {remainingPosts.map((post, idx) => (
          <PostCard key={post.id} post={post} index={idx + 1} variant="compact" />
        ))}
        
        {!isLoading && filteredPosts.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px', 
            color: 'var(--text-muted)' 
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.7 }}>📭</div>
            <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>No stories yet</p>
            <p style={{ fontWeight: 400, fontSize: '13px', color: 'var(--text-subtle)' }}>
              {activeCategory === 'All' 
                ? 'Be the first to publish a story'
                : `No stories in ${activeCategory} category`}
            </p>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-subtle)', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className="spinner" />
            Loading stories...
          </div>
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
