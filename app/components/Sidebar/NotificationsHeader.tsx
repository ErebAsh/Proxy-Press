'use client';

import './NotificationsHeader.css';

interface NotificationsHeaderProps {
  unreadCount: number;
  onMarkAllRead: () => void;
}

export default function NotificationsHeader({ unreadCount, onMarkAllRead }: NotificationsHeaderProps) {
  return (
    <header className="notifications-header">
      <div className="notifications-header-container">
        <div className="notifications-header-left">
          <h1 className="notifications-header-title">
            Notifications
            {unreadCount > 0 && (
              <span className="notifications-header-count">{unreadCount}</span>
            )}
          </h1>
        </div>
        <div className="notifications-header-right">
          {unreadCount > 0 && (
            <button
              className="notifications-header-btn"
              onClick={onMarkAllRead}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Mark Read</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
