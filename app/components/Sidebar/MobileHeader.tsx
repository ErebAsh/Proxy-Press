'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/lib/NotificationsContext';
import './MobileHeader.css';

export default function MobileHeader() {
  const pathname = usePathname();
  const { unreadCount, markAllRead } = useNotifications();

  const isNotifications = pathname === '/notifications';
  const isExplore = pathname === '/explore';

  return (
    <header className="mobile-header">
      <div className="mobile-header-container">
        {isNotifications ? (
          <>
            <div className="mobile-header-left">
              <h1 className="mobile-header-title">
                Notifications
                {unreadCount > 0 && (
                  <span className="mobile-header-count">{unreadCount}</span>
                )}
              </h1>
            </div>
            <div className="mobile-header-right">
              {unreadCount > 0 && (
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
              <Link href="/messages" className="premium-message-btn" aria-label="Messages">
                <svg 
                  width="28" 
                  height="28" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  strokeWidth="2.8" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <defs>
                    <linearGradient id="msg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                  <path 
                    d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" 
                    stroke="url(#msg-grad)"
                  />
                  <path d="M8 12h.01" stroke="url(#msg-grad)" />
                  <path d="M12 12h.01" stroke="url(#msg-grad)" />
                  <path d="M16 12h.01" stroke="url(#msg-grad)" />
                </svg>
                <span className="mobile-header-badge glass">2</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
