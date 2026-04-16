'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { posts, categories } from '@/lib/data';
import type { Category } from '@/lib/data';
import './explore.css';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
  News: '#6366F1', "College Daily Update": '#14B8A6', Others: '#94A3B8',
};

export default function ExplorePage() {
  const [active, setActive] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = active === 'All' ? posts : posts.filter(p => p.category === active);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return result;
  }, [active, searchQuery]);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-header-page', 'extra-bottom-space');
      return () => main.classList.remove('no-header-page', 'extra-bottom-space');
    }
  }, []);

  return (
    <div className="explore-container feed-container" id="explore-page">
      {/* Header */}
      <div className="explore-header-premium" style={{ textAlign: 'center', padding: '0 0 20px' }}>
        <h1 className="explore-title" style={{ 
          fontSize: '32px', 
          background: 'linear-gradient(to right, var(--text-primary), var(--primary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '2px',
          fontWeight: 800
        }}>
          Explore
        </h1>
        <p className="explore-subtitle" style={{ fontSize: '14px', opacity: 0.7, fontWeight: 500, marginBottom: '24px' }}>
          Discover stories from every corner of campus
        </p>

        {/* Beautiful Search Bar */}
        <div style={{ position: 'relative', maxWidth: '440px', margin: '0 auto 24px' }}>
          <div style={{ 
            position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', display: 'flex'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search stories, events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: '52px', background: 'var(--surface-2)',
              border: '2px solid var(--border)', borderRadius: '16px',
              padding: '0 20px 0 52px', fontSize: '15px', color: 'var(--text-primary)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)', transition: 'all 0.2s',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.backgroundColor = 'var(--surface)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'var(--surface-2)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
            }}
          />
        </div>

        <div style={{ 
          height: '1px', width: '100%', 
          background: 'linear-gradient(to right, transparent, var(--border), transparent)',
          marginBottom: '4px'
        }} />
      </div>

      {/* Category filter */}
      <div className="explore-filter-scroll" id="explore-filters">
        <button
          className={`explore-pill ${active === 'All' ? 'active' : ''}`}
          onClick={() => setActive('All')}
          id="filter-all"
        >
          <span>🌐</span> All
        </button>
        {categories.map(cat => (
          <button
            key={cat.name}
            id={`filter-${cat.name.toLowerCase()}`}
            className={`explore-pill ${active === cat.name ? 'active' : ''}`}
            onClick={() => setActive(cat.name)}
          >
            <span>{cat.emoji}</span> {cat.name}
          </button>
        ))}
      </div>

      {/* Modern Grid */}
      <div className="explore-grid" id="explore-grid">
        {filtered.map((post) => {
          const color = categoryColors[post.category];
          return (
            <Link
              key={post.id}
              href={`/article/${post.slug}`}
              className="explore-item"
              id={`explore-item-${post.id}`}
            >
              <img 
                src={post.imageUrl} 
                alt={post.title} 
                loading="lazy" 
              />
              <div className="explore-content-overlay">
                <span className="explore-item-category" style={{ background: `${color}40` }}>
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

