'use client';

import { useState } from 'react';
import { notifications } from '@/lib/data';
import type { Notification } from '@/lib/data';
import NotificationsHeader from '@/app/components/Sidebar/NotificationsHeader';

const notifConfig: Record<Notification['type'], { emoji: string; color: string; bg: string }> = {
  like:    { emoji: '❤️', color: '#EF4444', bg: '#FEE2E2' },
  comment: { emoji: '💬', color: '#2563EB', bg: '#DBEAFE' },
  mention: { emoji: '@',  color: '#8B5CF6', bg: '#EDE9FE' },
  alert:   { emoji: '🔔', color: '#F59E0B', bg: '#FEF3C7' },
  follow:  { emoji: '👤', color: '#10B981', bg: '#D1FAE5' },
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(notifications);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
  const markRead = (id: string) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
  const dismiss = (id: string) => setNotifs(ns => ns.filter(n => n.id !== id));

  const today = notifs.filter((_, i) => i < 4);
  const earlier = notifs.filter((_, i) => i >= 4);

  const NotifItem = ({ n }: { n: Notification }) => {
    const cfg = notifConfig[n.type];
    return (
      <div
        id={`notif-${n.id}`}
        className={`notif-item ${n.isRead ? '' : 'unread'}`}
        onClick={() => markRead(n.id)}
        style={{ position: 'relative' }}
      >
        {/* Type icon */}
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: cfg.bg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '18px', flexShrink: 0,
          position: 'relative',
        }}>
          {n.actorAvatar}
          <span style={{
            position: 'absolute', bottom: '-2px', right: '-2px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: cfg.bg, border: '2px solid var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px',
          }}>
            {cfg.emoji === '@' ? (
              <span style={{ fontSize: '9px', fontWeight: 800, color: cfg.color }}>@</span>
            ) : cfg.emoji}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 600 }}>{n.actor}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{n.message}</span>
          </p>
          {n.postTitle && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{n.postTitle}"
            </p>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
            {n.timeAgo}
          </span>
        </div>

        {/* Unread dot */}
        {!n.isRead && (
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--primary)', flexShrink: 0, marginTop: '6px',
          }} />
        )}

        {/* Dismiss button */}
        <button
          onClick={e => { e.stopPropagation(); dismiss(n.id); }}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'transparent', border: 'none',
            color: 'var(--text-subtle)', cursor: 'pointer',
            fontSize: '16px', lineHeight: 1, padding: '2px 4px',
            borderRadius: '4px', opacity: 0,
            transition: 'opacity var(--transition-fast)',
          }}
          className="dismiss-btn"
          aria-label="Dismiss notification"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div className="feed-container animate-fade-in" style={{ maxWidth: '640px' }} id="notifications-page">
      <NotificationsHeader unreadCount={unreadCount} onMarkAllRead={markAllRead} />
      {/* Header */}
      <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Notifications
            {unreadCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: '#fff',
                fontSize: '13px', fontWeight: 700,
                padding: '2px 10px', borderRadius: 'var(--radius-full)',
              }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {unreadCount > 0 ? `You have ${unreadCount} unread notifications` : 'All caught up! 🎉'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            id="mark-all-read-btn"
            className="btn btn-ghost"
            style={{ fontSize: '13px', padding: '8px 14px' }}
            onClick={markAllRead}
          >
            ✓ Mark all read
          </button>
        )}
      </div>

      {notifs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔔</div>
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)' }}>No notifications</p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            When someone likes or comments on your posts, you'll see it here.
          </p>
        </div>
      )}

      {/* Today */}
      {today.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <div className="section-label" style={{ padding: '0 4px', marginBottom: '8px' }}>Today</div>
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {today.map((n, i) => (
              <div key={n.id}>
                <NotifItem n={n} />
                {i < today.length - 1 && <div style={{ height: '1px', background: 'var(--border-light)', margin: '0 16px' }} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Earlier */}
      {earlier.length > 0 && (
        <section>
          <div className="section-label" style={{ padding: '0 4px', marginBottom: '8px' }}>Earlier</div>
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {earlier.map((n, i) => (
              <div key={n.id}>
                <NotifItem n={n} />
                {i < earlier.length - 1 && <div style={{ height: '1px', background: 'var(--border-light)', margin: '0 16px' }} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
