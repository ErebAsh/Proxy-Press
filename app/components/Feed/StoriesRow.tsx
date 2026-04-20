'use client';

import { categories } from '@/lib/data';

const stories: any[] = [];

export default function StoriesRow() {
  return (
    <div
      className="card"
      style={{ padding: '20px 12px', marginBottom: '20px' }}
      id="stories-section"
    >
      <div className="h-scroll" style={{ gap: '20px', padding: '0 8px 4px' }}>
        {/* Add story button */}
        <div className="story-circle" id="story-add-new">
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            border: '2px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', background: 'var(--surface-2)',
            transition: 'all var(--transition-base)',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--primary)';
              el.style.background = 'var(--primary-light)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--border)';
              el.style.background = 'var(--surface-2)';
            }}
          >
            ➕
          </div>
          <span className="story-label">Your Story</span>
        </div>

        {stories.map((story, idx) => (
          <div
            key={story.label}
            className="story-circle"
            id={`story-${story.label.toLowerCase()}`}
          >
            <div className="story-ring" style={{
              background: `linear-gradient(135deg, ${story.color}, ${story.color}99)`,
            }}>
              <div className="story-inner" style={{ fontSize: '24px' }}>
                {story.emoji}
              </div>
            </div>
            <span className="story-label">{story.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
