'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { categories } from '@/lib/data';
import type { Category } from '@/lib/data';
import { searchExploreAction, getExploreDataAction, toggleFollow, getCurrentUser, getFollowing } from '@/lib/actions';
import './explore.css';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
  News: '#6366F1', "College Daily Update": '#14B8A6', Others: '#94A3B8',
};

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Results
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<{ users: any[], posts: any[] }>({ users: [], posts: [] });
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadInitial() {
      try {
        const [data, user] = await Promise.all([
          getExploreDataAction(),
          getCurrentUser(),
        ]);
        setTrendingPosts(data.trendingPosts);
        setSuggestedUsers(data.suggestedUsers);
        
        if (user) {
          setCurrentUserId(user.id);
          const following = await getFollowing(user.id);
          setMyFollowingIds(new Set(following.map((u: any) => u.id)));
        }
      } catch (err) {
        console.error('Failed to load explore data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitial();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ users: [], posts: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchExploreAction(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleListFollowToggle = async (targetUserId: string) => {
    if (!currentUserId || targetUserId === currentUserId) return;

    const isCurrentlyFollowing = myFollowingIds.has(targetUserId);
    if (isCurrentlyFollowing) return; // Unfollow disabled from explore
    
    const newFollowingIds = new Set(myFollowingIds);
    newFollowingIds.add(targetUserId);
    
    setMyFollowingIds(newFollowingIds);

    try {
      const result = await toggleFollow(targetUserId);
      if (!result.success) {
        // Rollback
        setMyFollowingIds(myFollowingIds);
      }
    } catch {
      setMyFollowingIds(myFollowingIds);
    }
  };

  const displayedPosts = searchQuery.trim() 
    ? searchResults.posts 
    : (activeCategory === 'All' ? trendingPosts : trendingPosts.filter(p => p.category === activeCategory));

  return (
    <div className="explore-container feed-container" id="explore-page">
      {/* Header */}
      <div className="explore-header-premium">
        <h1 className="explore-title">Explore</h1>
        <p className="explore-subtitle">Discover stories and people from campus</p>

        {/* Premium Search Bar */}
        <div style={{ position: 'relative', maxWidth: '480px', margin: '0 auto 4px' }}>
          <div style={{ 
            position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', display: 'flex'
          }}>
            {isSearching ? (
              <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
          </div>
          <input 
            type="text" 
            placeholder="Search accounts, stories, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: '54px', background: 'var(--surface-2)',
              border: '2px solid var(--border)', borderRadius: '18px',
              padding: '0 20px 0 52px', fontSize: '15.5px', color: 'var(--text-primary)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              outline: 'none', boxShadow: 'var(--shadow-sm)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.backgroundColor = 'var(--surface)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'var(--surface-2)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          />
        </div>
      </div>

      {/* SEARCH RESULTS: USERS */}
      {searchQuery.trim() !== '' && searchResults.users.length > 0 && (
        <section className="explore-section">
          <h2 className="explore-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Accounts
          </h2>
          <div className="explore-users-list">
            {searchResults.users.map(user => (
              <Link key={user.id} href={`/profile/${user.id}`} className="explore-user-card">
                <div className="explore-user-avatar">
                   {user.profilePicture ? <img src={user.profilePicture} alt={user.name} /> : user.avatar}
                </div>
                <div className="explore-user-info">
                  <span className="explore-user-name">{user.name}</span>
                  <span className="explore-user-handle">@{user.username || user.id} • {user.college}</span>
                </div>
                {currentUserId && user.id !== currentUserId && (
                  <button 
                    className="explore-user-follow-btn" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      handleListFollowToggle(user.id); 
                    }}
                    style={{
                      background: myFollowingIds.has(user.id) ? 'var(--surface-2)' : 'var(--primary)',
                      color: myFollowingIds.has(user.id) ? 'var(--text-primary)' : '#fff',
                      border: myFollowingIds.has(user.id) ? '1px solid var(--border)' : 'none',
                      cursor: myFollowingIds.has(user.id) ? 'default' : 'pointer',
                      opacity: myFollowingIds.has(user.id) ? 0.7 : 1,
                    }}
                    disabled={myFollowingIds.has(user.id)}
                  >
                    {myFollowingIds.has(user.id) ? 'Following' : 'Follow'}
                  </button>
                 )}
              </Link>
            ))}
          </div>
        </section>
      )}


      {/* Category filter */}
      {!searchQuery.trim() && (
        <div className="explore-filter-scroll" id="explore-filters">
          <button
            className={`explore-pill ${activeCategory === 'All' ? 'active' : ''}`}
            onClick={() => setActiveCategory('All')}
          >
             All
          </button>
          {categories.map(cat => (
            <button
              key={cat.name}
              className={`explore-pill ${activeCategory === cat.name ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.name)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Post Grid Section Title */}
      <h2 className="explore-section-title">
         {searchQuery.trim() ? 'Top Stories' : (activeCategory === 'All' ? 'Trending Now' : activeCategory)}
      </h2>

      {/* Editorial Grid */}
      <div className="explore-grid" id="explore-grid">
        {isLoading ? (
          // Skeleton placeholders
          Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className={`explore-item ${i % 3 === 0 ? 'large' : ''}`} style={{ opacity: 0.5 }}>
               <div style={{ width: '100%', height: '100%', background: 'var(--surface-3)' }} />
             </div>
          ))
        ) : displayedPosts.map((post, idx) => {
          const color = categoryColors[post.category] || '#94A3B8';
          // Make first item and every 5th item large for editorial feel
          const isLarge = idx === 0 || idx % 5 === 0;
          return (
            <Link
              key={post.id}
              href={`/article/${post.slug}`}
              className={`explore-item ${isLarge ? 'large' : ''}`}
            >
              <img 
                src={post.imageUrl} 
                alt={post.title} 
                loading="lazy" 
              />
              <div className="explore-content-overlay">
                <span className="explore-item-category" style={{ background: `${color}` }}>
                  {post.category}
                </span>
                <h3 className="explore-item-title">{post.title}</h3>
                <div className="explore-item-stats">
                  <span>❤️ {post.likes}</span>
                  <span>💬 {post.comments}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {!isLoading && displayedPosts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <p style={{ fontWeight: 600, fontSize: '16px' }}>No matches found</p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>Try searching for something else</p>
        </div>
      )}
    </div>
  );
}


