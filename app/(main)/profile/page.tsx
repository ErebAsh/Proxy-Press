'use client';

import { useState, useEffect } from 'react';
import { posts, currentUser } from '@/lib/data';
import './profile.css';
import Link from 'next/link';

const userPosts = posts.slice(0, 7);
const savedPosts = posts.filter(p => p.isSaved);

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
  News: '#6366F1', "College Daily Update": '#14B8A6', Others: '#94A3B8',
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const displayPosts = activeTab === 'posts' ? userPosts : savedPosts;


  return (
    <div className="ig-profile animate-fade-in" id="profile-page" style={{ position: 'relative' }}>
      

      <div className="ig-header-main">
        <div className="ig-avatar-outer">
          <Link href="/" className="ig-header-back-btn" aria-label="Go back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </Link>

          <div className="ig-avatar-ring jumbo">
            <div className="ig-avatar-inner jumbo">
              {currentUser.avatar}
            </div>
          </div>
          
          <Link href="/settings" className="ig-header-settings-btn" aria-label="Settings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
            </svg>
          </Link>
        </div>
      </div>

      <div className="ig-profile-bio-modern">
        <h1 className="ig-display-name">{currentUser.name}</h1>
        <p className="ig-college-tag">MIT Campus Press</p>
        <p className="ig-bio-text">{currentUser.bio}</p>
      </div>

      <div className="ig-stats-container-modern stats-bar">
        <div className="ig-stat">
          <span className="ig-stat-value">{currentUser.posts}</span>
          <span className="ig-stat-label">Posts</span>
        </div>
        <div className="ig-stat">
          <span className="ig-stat-value">1.2k</span>
          <span className="ig-stat-label">Followers</span>
        </div>
        <div className="ig-stat">
          <span className="ig-stat-value">{currentUser.following}</span>
          <span className="ig-stat-label">Following</span>
        </div>
      </div>

      <div className="ig-profile-actions">
        <button
          className={`ig-action-btn ${isFollowing ? 'ig-action-btn-following' : 'ig-action-btn-follow'}`}
          id="follow-btn"
          onClick={() => setIsFollowing(prev => !prev)}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
        
        <Link href="/messages?chatId=1" className="ig-action-btn ig-action-btn-message">
          Message
        </Link>

        <button className="ig-action-btn-icon" aria-label="Discover people">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </button>
      </div>

      {/* ─── Tabs (Icons) ─── */}
      <div className="ig-tabs">
        <button
          className={`ig-tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
          aria-label="Posts"
          id="profile-tab-posts"
        >
          {/* Grid icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill={activeTab === 'posts' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <button
          className={`ig-tab ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => setActiveTab('saved')}
          aria-label="Saved"
          id="profile-tab-saved"
        >
          {/* Bookmark icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill={activeTab === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {/* ─── Post Grid ─── */}
      {displayPosts.length > 0 ? (
        <div className="ig-grid" id="profile-grid">
          {displayPosts.map(post => (
            <Link
              key={post.id}
              href={`/article/${post.slug}`}
              className="ig-grid-item"
              id={`grid-post-${post.id}`}
            >
              <img 
                src={post.imageUrl} 
                alt={post.title} 
                loading="lazy" 
              />
              <div className="ig-grid-overlay-premium">
                <span 
                  className="ig-grid-category" 
                  style={{ background: `${categoryColors[post.category] || '#6366f1'}40` }}
                >
                  {post.category}
                </span>
                <h3 className="ig-grid-title">{post.title}</h3>
                <div className="ig-grid-stats-row">
                  <span className="ig-grid-stat">
                    ❤️ {post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : post.likes}
                  </span>
                  <span className="ig-grid-stat">
                    💬 {post.comments}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="ig-empty">
          <div className="ig-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {activeTab === 'saved' ? (
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </>
              )}
            </svg>
          </div>
          <h2 className="ig-empty-title">
            {activeTab === 'saved' ? 'Save' : 'Share Photos'}
          </h2>
          <p className="ig-empty-subtitle">
            {activeTab === 'saved'
              ? "Save photos and videos that you want to see again."
              : "When you share photos, they will appear on your profile."}
          </p>
          <Link
            href={activeTab === 'saved' ? '/' : '/create'}
            className="ig-empty-link"
          >
            {activeTab === 'saved' ? 'Browse the feed' : 'Share your first post'}
          </Link>
        </div>
      )}
    </div>
  );
}
