'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { currentUser, posts } from '@/lib/data';
import './profile.css';

const userPosts = posts.slice(0, 7);
const savedPosts = posts.filter(p => p.isSaved);

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
  News: '#6366F1', "College Daily Update": '#14B8A6', Others: '#94A3B8',
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const displayPosts = activeTab === 'posts' ? userPosts : savedPosts;

  // Close settings dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);
  
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('profile-no-header', 'extra-bottom-space');
      return () => main.classList.remove('profile-no-header', 'extra-bottom-space');
    }
  }, []);

  return (
    <div className="ig-profile animate-fade-in" id="profile-page" style={{ position: 'relative' }}>
      
      {/* ─── Profile Header: Avatar ─── */}
      <div className="ig-profile-header-centered">
        <div className="ig-avatar-wrapper">
          <div className="ig-avatar-ring">
            <div className="ig-avatar-inner">
              {currentUser.avatar}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Profile Info ─── */}
      <div className="ig-profile-info-centered">
        <h1 className="ig-display-name">{currentUser.name}</h1>
        <p className="ig-username">@alexj · {currentUser.college}</p>
        <p className="ig-bio">{currentUser.bio}</p>
      </div>

      {/* ─── Stats Bar (Moved Down) ─── */}
      <div className="ig-stats-bar">
        <div className="ig-stat">
          <span className="ig-stat-value">{currentUser.posts}</span>
          <span className="ig-stat-label">Posts</span>
        </div>
        <div className="ig-stat">
          <span className="ig-stat-value">{currentUser.followers.toLocaleString()}</span>
          <span className="ig-stat-label">Followers</span>
        </div>
        <div className="ig-stat">
          <span className="ig-stat-value">{currentUser.following.toLocaleString()}</span>
          <span className="ig-stat-label">Following</span>
        </div>
      </div>

      {/* ─── Action Buttons ─── */}
      <div className="ig-profile-actions">
        <button
          className={`ig-action-btn ${isFollowing ? 'ig-action-btn-following' : 'ig-action-btn-follow'}`}
          id="follow-btn"
          onClick={() => setIsFollowing(prev => !prev)}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
        
        <div className="ig-settings-container" ref={settingsRef}>
          <button 
            className="ig-action-btn ig-action-btn-settings"
            onClick={() => setSettingsOpen(prev => !prev)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>

          {settingsOpen && (
            <div className="ig-settings-dropdown" id="settings-dropdown">
              <button className="ig-settings-item" id="edit-profile-btn" onClick={() => setSettingsOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Profile
              </button>
              <button className="ig-settings-item" onClick={() => setSettingsOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Privacy
              </button>
              <button className="ig-settings-item" onClick={() => setSettingsOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                Notifications
              </button>
              <button className="ig-settings-item" onClick={() => setSettingsOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                About
              </button>
              <div className="ig-settings-divider"></div>
              <button className="ig-settings-item ig-settings-item-danger" onClick={() => setSettingsOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log Out
              </button>
            </div>
          )}
        </div>

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
