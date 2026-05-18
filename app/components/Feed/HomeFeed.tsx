'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Category, Post } from '@/lib/data';
import { categories } from '@/lib/data';
import PostCard from './PostCard';
import { getInitialData, getCurrentUser, getProfileData, getMorePosts } from '@/lib/actions';
import { OfflineManager } from '@/lib/offline-manager';

let globalInMemoryPosts: any[] = [];
let globalInMemoryLoaded = false;
let globalSessionFetchAttempted = false; // Tracks if we already fetched during this session

export default function HomeFeed() {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<any[]>(globalInMemoryPosts);

  // Auto-close menu after 5 seconds of inactivity
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCategoryMenuOpen) {
      timer = setTimeout(() => {
        setIsCategoryMenuOpen(false);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isCategoryMenuOpen]);
  const [isLoading, setIsLoading] = useState(!globalInMemoryLoaded);
  const [offset, setOffset] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const cacheLoaded = useRef(false);
  const freshDataLoaded = useRef(false);

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const user = await getCurrentUser();
      const morePosts = await getMorePosts(user?.id, 10, offset);
      
      if (morePosts && morePosts.length > 0) {
        const adaptedPosts = morePosts.map((p: any) => ({
          ...p,
          timeAgo: p.publishedAt ? formatTimeAgo(p.publishedAt) : 'Recently',
          isLiked: Array.isArray(p.likesList) ? p.likesList.some((l: any) => l.userId === user?.id) : false,
        }));
        
        setPosts(prev => [...prev, ...adaptedPosts]);
        setOffset(prev => prev + 10);
        if (morePosts.length < 10) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    setMounted(true);
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
      // Only do background fetch on app open or hard refresh (once per session)
      if (globalSessionFetchAttempted) {
        console.log('[Background] Skipping network fetch (already fetched this session).');
        return;
      }
      globalSessionFetchAttempted = true;

      try {
        const user = await getCurrentUser();
        
        const data = await getInitialData(user?.id) as any;
        
        if (data && data.posts) {
          freshDataLoaded.current = true;
          const adaptedPosts = data.posts.map((p: any) => ({
            ...p,
            timeAgo: p.publishedAt ? formatTimeAgo(p.publishedAt) : 'Recently',
            isLiked: Array.isArray(p.likesList) ? p.likesList.some((l: any) => l.userId === user?.id) : false,
          }));
          
          setPosts(prevPosts => {
            // Check if new content is available by comparing first post ID or length
            const isNewContentAvailable = 
              prevPosts.length === 0 || 
              (adaptedPosts.length > 0 && prevPosts[0].id !== adaptedPosts[0].id) ||
              prevPosts.length !== adaptedPosts.length;
            
            if (isNewContentAvailable) {
              console.log('[Background] New content found, updating feed.');
              globalInMemoryPosts = adaptedPosts;
              return adaptedPosts;
            }
            
            console.log('[Background] No new content, keeping cached view.');
            return prevPosts;
          });
          
          globalInMemoryLoaded = true;
          
          // 2. Update cache with fresh data in the background
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

  // ─── INFINITE SCROLL LOGIC ───
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.5 }
    );
    
    const target = document.getElementById('load-more-trigger');
    if (target) observer.observe(target);
    
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, isLoadingMore, offset]);

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
      setPullDistance(40); // Keep it down slightly to show the "Updating..." text
      await performRefresh();
    }
    setPullDistance(0); // Reset to normal
  };

  const performRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Sync from server to SQLite with a 5-second timeout
      const syncPromise = OfflineManager.syncHomeFeed();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout')), 5000)
      );
      await Promise.race([syncPromise, timeoutPromise]);
      
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
    <>
      <style>{`
        @keyframes floating-btn {
          0% { translate: 0 0px; }
          50% { translate: 0 -6px; }
          100% { translate: 0 0px; }
        }
      `}</style>
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

      {/* Category filters removed - replaced by floating button */}

      {/* News feed */}
      <div id="posts-feed" style={{ padding: '4px 16px 35px' }}>
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
            padding: '30px 20px', 
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

        {/* Trigger for infinite scroll */}
        <div id="load-more-trigger" style={{ height: '20px', background: 'transparent' }} />

        {isLoadingMore && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-subtle)', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              Loading more...
            </div>
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

      {/* Floating Category Button */}
      {mounted && createPortal(
        <div style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)',
          right: '16px',
          zIndex: 1000,
        }}>
          {/* Invisible backdrop to close menu when clicking outside */}
          <div 
            onClick={() => setIsCategoryMenuOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.1)', // Subtle dim
              zIndex: 999,
              opacity: isCategoryMenuOpen ? 1 : 0,
              visibility: isCategoryMenuOpen ? 'visible' : 'hidden',
              transition: 'opacity 0.2s ease, visibility 0.2s',
            }}
          />
          
          {/* Menu */}
          <div style={{
            position: 'absolute',
            bottom: '0', // Sit where the button was
            right: '0',
            background: 'var(--surface, #1a1a1a)',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: '160px',
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            zIndex: 1000,
            // Transition
            opacity: isCategoryMenuOpen ? 1 : 0,
            transform: isCategoryMenuOpen ? 'scale(1)' : 'scale(0.8)',
            transformOrigin: 'bottom right',
            visibility: isCategoryMenuOpen ? 'visible' : 'hidden',
            transition: 'transform 0.2s cubic-bezier(0.2, 1, 0.2, 1), opacity 0.2s ease, visibility 0.2s',
          }}>
            <button
              onClick={() => { setActiveCategory('All'); setIsCategoryMenuOpen(false); }}
              style={{
                padding: '10px 14px',
                border: 'none',
                background: activeCategory === 'All' ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                color: activeCategory === 'All' ? '#0284c7' : 'var(--text, #ffffff)',
                borderRadius: '10px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontWeight: activeCategory === 'All' ? '600' : '400',
                fontSize: '14px',
              }}
            >
              <span>🌎</span>
              <span>All news</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => { setActiveCategory(cat.name); setIsCategoryMenuOpen(false); }}
                style={{
                  padding: '10px 14px',
                  border: 'none',
                  background: activeCategory === cat.name ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                  color: activeCategory === cat.name ? '#0284c7' : 'var(--text, #ffffff)',
                  borderRadius: '10px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontWeight: activeCategory === cat.name ? '600' : '400',
                  fontSize: '14px',
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
          
          {/* Floating Button */}
          <button
            onClick={() => setIsCategoryMenuOpen(true)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '28px',
              background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', // Vibrant blue gradient
              color: 'white',
              border: 'none',
              boxShadow: '0 8px 25px rgba(37, 99, 235, 0.5)', // Stronger blue glow
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '38px', // Even bigger logo
              cursor: 'pointer',
              // Transition
              opacity: isCategoryMenuOpen ? 0 : 1,
              scale: isCategoryMenuOpen ? '0.8' : '1',
              visibility: isCategoryMenuOpen ? 'hidden' : 'visible',
              animation: isCategoryMenuOpen ? 'none' : 'floating-btn 3s ease-in-out infinite',
              transition: 'scale 0.2s ease, opacity 0.2s ease, visibility 0.2s',
            }}
            onMouseDown={(e) => e.currentTarget.style.scale = '0.95'}
            onMouseUp={(e) => e.currentTarget.style.scale = '1'}
          >
            {activeCategory === 'All' ? '🌎' : categories.find(c => c.name === activeCategory)?.emoji || '📁'}
          </button>
        </div>,
        document.body
      )}
    </>
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
