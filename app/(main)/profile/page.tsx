'use client';

import { useState } from 'react';
import Link from 'next/link';
import { currentUser, posts } from '@/lib/data';

const userPosts = posts.slice(0, 7);
const savedPosts = posts.filter(p => p.isSaved);

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const displayPosts = activeTab === 'posts' ? userPosts : savedPosts;

  const stats = [
    { label: 'Posts', value: currentUser.posts },
    { label: 'Followers', value: currentUser.followers.toLocaleString() },
    { label: 'Following', value: currentUser.following.toLocaleString() },
  ];

  return (
    <div className="feed-container animate-fade-in" style={{ maxWidth: '720px' }} id="profile-page">

      {/* Profile Header Card */}
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        {/* Cover gradient bar */}
        <div style={{
          height: '80px', borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, #2563EB 0%, #8B5CF6 50%, #EC4899 100%)',
          marginBottom: '-40px',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '20px' }}>
          {/* Avatar */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563EB, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', border: '4px solid var(--surface)',
            flexShrink: 0, boxShadow: 'var(--shadow-md)',
          }}>
            {currentUser.avatar}
          </div>
          <div style={{ flex: 1, paddingBottom: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {currentUser.name}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>@alexj · {currentUser.college}</p>
          </div>
          {/* Edit button */}
          <button
            id="edit-profile-btn"
            className="btn btn-ghost"
            style={{ fontSize: '13px', padding: '8px 16px', alignSelf: 'flex-end', marginBottom: '8px' }}
          >
            ✏️ Edit Profile
          </button>
        </div>

        {/* Bio */}
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
          {currentUser.bio}
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          {stats.map(stat => (
            <div key={stat.label} className="profile-stat" style={{ flex: 1 }}>
              <span className="profile-stat-value">{stat.value}</span>
              <span className="profile-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '2px solid var(--border)',
        marginBottom: '20px', background: 'var(--surface)',
        borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
        overflow: 'hidden',
      }}>
        {(['posts', 'saved'] as const).map(tab => (
          <button
            key={tab}
            id={`profile-tab-${tab}`}
            className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ flex: 1, textAlign: 'center', background: 'transparent', border: 'none' }}
          >
            {tab === 'posts' ? '📰 Posts' : '🔖 Saved'}
            {tab === 'posts' && (
              <span style={{ marginLeft: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-subtle)' }}>
                ({userPosts.length})
              </span>
            )}
            {tab === 'saved' && (
              <span style={{ marginLeft: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-subtle)' }}>
                ({savedPosts.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Post Grid */}
      {displayPosts.length > 0 ? (
        <div className="profile-grid" id="profile-grid">
          {displayPosts.map(post => (
            <Link
              key={post.id}
              href={`/article/${post.slug}`}
              className="profile-grid-item"
              id={`grid-post-${post.id}`}
              style={{ textDecoration: 'none' }}
            >
              <img
                src={post.imageUrl}
                alt={post.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
                onError={e => {
                  const t = e.currentTarget as HTMLImageElement;
                  t.style.display = 'none';
                  const fb = t.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = 'flex';
                }}
              />
              <div style={{
                display: 'none', width: '100%', height: '100%',
                background: post.imageColor || 'var(--surface-2)',
                alignItems: 'center', justifyContent: 'center', fontSize: '32px',
              }}
                className="profile-grid-fallback"
              >
                📰
              </div>
              <div className="profile-grid-overlay">
                <span>❤️ {post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : post.likes}</span>
                <span>💬 {post.comments}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {activeTab === 'saved' ? '🔖' : '📰'}
          </div>
          <p style={{ fontWeight: 600 }}>
            {activeTab === 'saved' ? 'No saved posts yet' : 'No posts yet'}
          </p>
          <Link href={activeTab === 'saved' ? '/' : '/create'} style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px', marginTop: '8px', display: 'inline-block' }}>
            {activeTab === 'saved' ? 'Browse the feed →' : 'Create your first post →'}
          </Link>
        </div>
      )}
    </div>
  );
}
