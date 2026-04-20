'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Post } from '@/lib/data';
import { togglePostLike, togglePostSave } from '@/lib/actions';

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
  const [liked, setLiked] = useState<boolean>(post.isLiked ?? false);
  const [saved, setSaved] = useState<boolean>(post.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(post.likes ?? 0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sync with post prop changes (e.g. after refresh/load)
  useEffect(() => {
    setLiked(!!post.isLiked);
    setSaved(!!post.isSaved);
    setLikeCount(post.likes ?? 0);
  }, [post.isLiked, post.isSaved, post.likes]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Optimistic UI
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);

    // Persistence
    try {
      await togglePostLike(post.id, 'u0');
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Rollback on error
      setLiked(!newLiked);
      setLikeCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic UI
    const newSaved = !saved;
    setSaved(newSaved);

    // Persistence
    try {
      await togglePostSave(post.id, 'u0');
    } catch (err) {
      console.error('Failed to toggle save:', err);
      // Rollback on error
      setSaved(!newSaved);
    }
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
              <div
                className="menu-item"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.origin + `/article/${post.slug}`);
                  setMenuOpen(false);
                }}
              >
                <span>🔗</span> Copy link
              </div>
              <Link 
                href={`/profile/${post.authorId || post.author.id}`}
                className="menu-item"
                style={{ textDecoration: 'none' }}
                onClick={() => setMenuOpen(false)}
              >
                <span>👤</span> View Profile
              </Link>
              <div
                className="menu-item danger"
                onClick={() => setMenuOpen(false)}
              >
                <span>🚩</span> Report
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image */}
      <Link href={`/article/${post.slug}`} style={{ display: 'block', marginTop: '14px', textDecoration: 'none' }}>
        <div className="post-image-wrapper" style={{ position: 'relative' }}>
          {/* Overlaid Category pill */}
          <span style={{
            position: 'absolute', top: '12px', left: '12px', zIndex: 10,
            padding: '4px 12px', borderRadius: '100px',
            fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)',
            border: `1px solid ${catColor}cc`, color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <span>{categoryEmojis[post.category]}</span>
            <span>{post.category}</span>
          </span>
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
          {/* Headline Overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
            padding: '24px 12px 12px', zIndex: 5
          }}>
            <h2 style={{
              fontWeight: 700, fontSize: '16px', lineHeight: 1.3,
              color: '#fff', margin: 0,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)'
            }}>
              {post.title}
            </h2>
          </div>
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
          onClick={handleSave}
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
