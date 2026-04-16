'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/lib/NotificationsContext';
import './MobileHeader.css';

export default function MobileHeader() {
  const pathname = usePathname();
  const { unreadCount, markAllRead } = useNotifications();

  const isNotifications = pathname === '/notifications';
  const isMessages = pathname === '/messages';
  const isExplore = pathname === '/explore';
  const isProfile = pathname === '/profile';
  const isCreate = pathname === '/create';

  if (isProfile || isCreate || isExplore) return null;

  return (
    <header className="mobile-header">
      <div className="mobile-header-container">
        {isNotifications || isMessages ? (
          <>
            <div className="mobile-header-left">
              <h1 className="mobile-header-title">
                {isNotifications ? 'Notifications' : 'Messages'}
                {isNotifications && unreadCount > 0 && (
                  <span className="mobile-header-count">{unreadCount}</span>
                )}
                {isMessages && (
                  <span className="mobile-header-count">2</span>
                )}
              </h1>
            </div>
            <div className="mobile-header-right">
              {isNotifications && unreadCount > 0 && (
                <button
                  className="mobile-header-action-btn"
                  onClick={markAllRead}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Mark Read</span>
                </button>
              )}
              {isMessages && (
                <button className="mobile-header-action-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>New</span>
                </button>
              )}
            </div>
          </>
        ) : isProfile ? (
          <>
            <div className="mobile-header-left">
              <h1 className="mobile-header-title" style={{ fontSize: '18px', letterSpacing: '-0.3px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                alexj
              </h1>
            </div>
            <div className="mobile-header-right" style={{ gap: '4px' }}>
              <button className="mobile-header-action-btn" aria-label="Create" style={{ padding: '6px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </button>
              <button className="mobile-header-action-btn" aria-label="Menu" style={{ padding: '6px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </div>
          </>
        ) : isExplore ? (
          <div className="mobile-search-wrapper" style={{ flex: 1 }}>
            <div className="mobile-search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder="Search..." 
              className="mobile-search-input"
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: 'var(--surface-2)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px 0 40px',
                fontSize: '15px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>
        ) : (
          <>
            <div className="mobile-header-left">
              <Link href="/" className="mobile-logo-link">
                <span className="mobile-logo-text">
                  Proxy<span className="mobile-logo-accent">Press</span>
                </span>
              </Link>
            </div>
            <div className="mobile-header-right">
              <Link href="/notifications" className="premium-notif-btn" aria-label="Notifications">
                <svg 
                  width="28" 
                  height="28" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <defs>
                    <linearGradient id="notif-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                  <path 
                    d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                    stroke="url(#notif-grad)"
                  />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="url(#notif-grad)" />
                </svg>
                {unreadCount > 0 && (
                  <span className="mobile-header-badge glass">{unreadCount}</span>
                )}
              </Link>
            </div>
          </>
        )}
      </div>
    </header>

  );
}
