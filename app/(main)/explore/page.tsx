'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { posts, categories } from '@/lib/data';
import type { Category } from '@/lib/data';
import ExploreHeader from '@/app/components/Sidebar/ExploreHeader';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
};
const categoryEmojis: Record<string, string> = {
  Events: '🎉', Notices: '📢', Sports: '⚽',
  Academic: '📚', Clubs: '🎭', Exams: '📝',
};

// Vary aspect ratios for masonry feel
const aspectRatios = ['4/3', '3/4', '1/1', '4/3', '3/4', '16/9', '3/4', '4/3'];

export default function ExplorePage() {
  const [active, setActive] = useState<Category | 'All'>('All');

  const filtered = useMemo(() =>
    active === 'All' ? posts : posts.filter(p => p.category === active),
    [active]
  );

  return (
    <div className="feed-container" style={{ maxWidth: '900px' }} id="explore-page">
      <ExploreHeader />
      {/* Header */}
      <div className="desktop-only" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Explore
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Discover stories from every corner of campus
        </p>
      </div>

      {/* Category filter */}
      <div className="h-scroll" style={{ marginBottom: '24px', gap: '8px' }} id="explore-filters">
        <button
          className={`category-pill ${active === 'All' ? 'active' : ''}`}
          onClick={() => setActive('All')}
          id="filter-all"
        >
          🌐 All
        </button>
        {categories.map(cat => (
          <button
            key={cat.name}
            id={`filter-${cat.name.toLowerCase()}`}
            className={`category-pill ${active === cat.name ? 'active' : ''}`}
            onClick={() => setActive(cat.name)}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      {/* Masonry grid */}
      <div className="masonry-grid" id="masonry-grid">
        {filtered.map((post, idx) => {
          const cat = post.category;
          const color = categoryColors[cat];
          const ratio = aspectRatios[idx % aspectRatios.length];
          return (
            <Link
              key={post.id}
              href={`/article/${post.slug}`}
              className="masonry-item"
              id={`masonry-${post.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  style={{ width: '100%', aspectRatio: ratio, objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                  onError={e => {
                    const t = e.currentTarget as HTMLImageElement;
                    t.style.display = 'none';
                    const fb = t.nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
                {/* Gradient fallback */}
                <div style={{
                  display: 'none', width: '100%', aspectRatio: ratio,
                  background: post.imageColor, alignItems: 'center',
                  justifyContent: 'center', fontSize: '48px',
                }}>
                  {categoryEmojis[cat]}
                </div>
                <div className="masonry-overlay">
                  <div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                      color: `${color}`, background: `${color}30`,
                      padding: '2px 8px', borderRadius: '99px',
                    }}>
                      {categoryEmojis[cat]} {cat}
                    </span>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '6px', lineHeight: 1.4 }}>
                      {post.title}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                      ❤️ {post.likes} · 💬 {post.comments}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <p style={{ fontWeight: 600, fontSize: '16px' }}>No posts in this category yet</p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>Check back soon!</p>
        </div>
      )}
    </div>
  );
}
