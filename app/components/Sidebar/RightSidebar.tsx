import Link from 'next/link';
import { categories, trendingTopics, announcements } from '@/lib/data';

export default function RightSidebar() {
  return (
    <aside className="right-sidebar" id="right-sidebar">

      {/* Trending Topics */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
            🔥 Trending
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {trendingTopics.map((topic, i) => (
            <div key={topic.tag} className="trending-item" id={`trending-${i + 1}`}>
              <span className="trending-rank">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topic.tag}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{topic.posts.toLocaleString()} posts</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* Categories */}
      <section style={{ marginBottom: '28px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
          📂 Categories
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/explore?category=${cat.name}`}
              id={`category-${cat.name.toLowerCase()}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                transition: 'background var(--transition-fast)', cursor: 'pointer',
              }}
                className="category-link-item"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', background: `${cat.color}18`,
                  flexShrink: 0,
                }}>
                  {cat.emoji}
                </div>
                <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>
                  {cat.name}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* Announcements */}
      <section>
        <h3 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
          📣 Announcements
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {announcements.map((ann) => (
            <div
              key={ann.id}
              id={`announcement-${ann.id}`}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: ann.type === 'alert'
                  ? 'rgba(239,68,68,0.08)'
                  : ann.type === 'warning'
                    ? 'rgba(245,158,11,0.08)'
                    : 'var(--surface-2)',
                borderLeft: `3px solid ${ann.type === 'alert' ? 'var(--accent)' : ann.type === 'warning' ? '#F59E0B' : 'var(--primary)'}`,
                cursor: 'pointer',
                transition: 'opacity var(--transition-fast)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '4px' }}>
                {ann.text}
              </p>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{ann.timeAgo}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer links */}
      <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {['About', 'Help', 'Privacy', 'Terms', 'Contact'].map(link => (
            <span key={link} style={{ fontSize: '11px', color: 'var(--text-subtle)', cursor: 'pointer', transition: 'color var(--transition-fast)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-subtle)'; }}>
              {link}
            </span>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '8px' }}>
          © 2026 Proxy-Press
        </p>
      </div>
    </aside>
  );
}
