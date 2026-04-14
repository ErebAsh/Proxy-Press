'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Post } from '@/lib/data';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6',
  Notices: '#F59E0B',
  Sports: '#10B981',
  Academic: '#2563EB',
  Clubs: '#EC4899',
  Exams: '#EF4444',
};

const categoryEmojis: Record<string, string> = {
  Events: '🎉',
  Notices: '📢',
  Sports: '⚽',
  Academic: '📚',
  Clubs: '🎭',
  Exams: '📝',
};

interface PostCardProps {
  post: Post;
  index?: number;
}

export default function PostCard({ post, index = 0 }: PostCardProps) {
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLike = () => {
    setLiked(prev => {
      setLikeCount(c => prev ? c - 1 : c + 1);
      return !prev;
    });
  };

  const catColor = categoryColors[post.category] ?? 'var(--primary)';

  return (
    <article
      className="post-card animate-fade-in"
      id={`post-${post.id}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 0', position: 'relative' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${catColor}, ${catColor}99)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>
          {post.author.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
            {post.author.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{post.author.college}</span>
            <span>·</span>
            <span>{post.timeAgo}</span>
          </div>
        </div>
        {/* Category badge */}
        <span style={{
          padding: '3px 10px', borderRadius: 'var(--radius-full)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
          background: `${catColor}18`, color: catColor,
        }}>
          {categoryEmojis[post.category]} {post.category}
        </span>
        {/* 3-dot menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-icon"
            id={`post-menu-${post.id}`}
            aria-label="Post options"
            onClick={() => setMenuOpen(o => !o)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            style={{ marginLeft: '4px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="menu-dropdown" id={`post-dropdown-${post.id}`}>
              {[
                { icon: '🔗', label: 'Copy link' },
                { icon: '📤', label: 'Share post' },
                { icon: '🔖', label: 'Save post' },
                { icon: '🚩', label: 'Report', danger: true },
              ].map(item => (
                <div
                  key={item.label}
                  className={`menu-item ${item.danger ? 'danger' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span>{item.icon}</span> {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image */}
      <Link href={`/article/${post.slug}`} style={{ display: 'block', marginTop: '14px' }}>
        <div className="post-image-wrapper">
          <img
            src={post.imageUrl}
            alt={post.title}
            className="post-image"
            loading="lazy"
            onError={(e) => {
              const t = e.currentTarget as HTMLImageElement;
              t.style.display = 'none';
              const fallback = t.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          {/* Gradient fallback */}
          <div style={{
            display: 'none', width: '100%', aspectRatio: '16/9',
            background: post.imageColor,
            alignItems: 'center', justifyContent: 'center',
            fontSize: '48px',
          }}>
            {categoryEmojis[post.category]}
          </div>
        </div>
      </Link>

      {/* Text content */}
      <div style={{ padding: '16px' }}>
        <Link href={`/article/${post.slug}`} style={{ textDecoration: 'none' }}>
          <h2 style={{
            fontWeight: 700, fontSize: '18px', lineHeight: 1.35,
            color: 'var(--text-primary)', marginBottom: '8px',
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            transition: 'color var(--transition-fast)',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          >
            {post.title}
          </h2>
        </Link>
        <p style={{
          fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {post.description}
        </p>
      </div>

      {/* Action row */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '4px 12px 12px',
        borderTop: '1px solid var(--border)', marginTop: '4px',
        paddingTop: '12px',
      }}>
        {/* Like */}
        <button
          id={`like-btn-${post.id}`}
          className={`action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}</span>
        </button>

        {/* Comment */}
        <Link href={`/article/${post.slug}`} style={{ textDecoration: 'none' }}>
          <button id={`comment-btn-${post.id}`} className="action-btn" aria-label="Comments">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{post.comments}</span>
          </button>
        </Link>

        {/* Share */}
        <button id={`share-btn-${post.id}`} className="action-btn" aria-label="Share"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: post.title, url: window.location.href });
            } else {
              navigator.clipboard?.writeText(window.location.origin + `/article/${post.slug}`);
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>Share</span>
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Save */}
        <button
          id={`save-btn-${post.id}`}
          className={`action-btn ${saved ? 'saved' : ''}`}
          onClick={() => setSaved(s => !s)}
          aria-label={saved ? 'Unsave' : 'Save'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </article>
  );
}
