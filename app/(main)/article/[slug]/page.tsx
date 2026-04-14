'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getPostBySlug, getRelatedPosts, posts } from '@/lib/data';
import PostCard from '@/app/components/Feed/PostCard';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
};

export default function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug) ?? posts[0];
  const related = getRelatedPosts(post, 3);
  const catColor = categoryColors[post.category] ?? 'var(--primary)';

  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);

  const paragraphs = post.content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  return (
    <div className="feed-container animate-fade-in" style={{ maxWidth: '720px' }} id="article-page">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          Home
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <Link href="/explore" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          {post.category}
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <span style={{ color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
          {post.title}
        </span>
      </div>

      {/* Category pill */}
      <span style={{
        display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)',
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em',
        background: `${catColor}18`, color: catColor, marginBottom: '16px',
      }}>
        {post.category}
      </span>

      {/* Headline */}
      <h1 style={{
        fontSize: '32px', fontWeight: 900, lineHeight: 1.2,
        color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.5px',
      }}>
        {post.title}
      </h1>

      {/* Author + meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${catColor}, ${catColor}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', flexShrink: 0,
        }}>
          {post.author.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
            {post.author.name}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {post.author.college} · {post.timeAgo}
          </div>
        </div>
        {/* Social actions top */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '13px' }}
            onClick={() => navigator.clipboard?.writeText(window.location.href)}>
            🔗 Copy Link
          </button>
        </div>
      </div>

      {/* Hero image */}
      <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '32px' }}>
        <img
          src={post.imageUrl}
          alt={post.title}
          className="article-hero"
          style={{ margin: 0, borderRadius: 0 }}
          onError={e => {
            const t = e.currentTarget as HTMLImageElement;
            t.style.display = 'none';
            const fb = t.nextElementSibling as HTMLElement | null;
            if (fb) fb.style.display = 'flex';
          }}
        />
        <div style={{
          display: 'none', width: '100%', height: '420px',
          background: post.imageColor, alignItems: 'center',
          justifyContent: 'center', fontSize: '80px',
        }}>
          🖼️
        </div>
      </div>

      {/* Article body */}
      <div className="article-body" id="article-body">
        {paragraphs.map((para, i) => {
          if (para.startsWith('## ')) {
            return <h2 key={i}>{para.replace('## ', '')}</h2>;
          }
          if (para.startsWith('**') && para.endsWith('**')) {
            return <p key={i}><strong>{para.slice(2, -2)}</strong></p>;
          }
          if (para.startsWith('- ')) {
            return <p key={i}>{'•  ' + para.slice(2)}</p>;
          }
          if (para.startsWith('|')) {
            // Skip table rows (simplified)
            return null;
          }
          return <p key={i}>{para}</p>;
        })}
      </div>

      {/* Like / Save / Share actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '20px 24px', borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-2)', margin: '32px 0',
        border: '1px solid var(--border)',
      }}>
        <button
          id="article-like-btn"
          onClick={() => { setLiked(p => { setLikeCount(c => p ? c - 1 : c + 1); return !p; }); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${liked ? 'var(--accent)' : 'var(--border)'}`,
            background: liked ? 'var(--accent-light)' : 'transparent',
            color: liked ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {liked ? 'Liked' : 'Like'} · {likeCount}
        </button>

        <button
          id="article-save-btn"
          onClick={() => setSaved(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${saved ? 'var(--primary)' : 'var(--border)'}`,
            background: saved ? 'var(--primary-light)' : 'transparent',
            color: saved ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {saved ? 'Saved' : 'Save'}
        </button>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>
          💬 {post.comments} comments
        </span>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <section id="related-posts">
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px', letterSpacing: '-0.3px' }}>
            Related Posts
          </h2>
          {related.map((rp, idx) => (
            <PostCard key={rp.id} post={rp} index={idx} />
          ))}
        </section>
      )}

      {related.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-subtle)' }}>
          <p>No related posts found in {post.category}.</p>
          <Link href="/explore" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px' }}>
            Explore all posts →
          </Link>
        </div>
      )}
    </div>
  );
}
