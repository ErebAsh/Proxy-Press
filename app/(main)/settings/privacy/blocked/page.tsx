'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../../settings.css';

export default function BlockedAccountsPage() {
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  return (
    <div className="settings-container">
      <div className="settings-header">
        <Link href="/settings/privacy" className="settings-back-btn" aria-label="Go back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="settings-title">Blocked Accounts</h1>
      </div>

      <div className="settings-content">
        {blockedUsers.length > 0 ? (
          <div className="settings-list">
            {blockedUsers.map(user => (
              <div key={user} className="settings-item">
                <div className="settings-item-content">
                  <div className="settings-item-text">
                    <span className="settings-item-label">{user}</span>
                  </div>
                </div>
                <button className="unblock-btn">Unblock</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-blocked-state">
            <div className="empty-icon-circle">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
               </svg>
            </div>
            <h2 className="empty-title">No Blocked Accounts</h2>
            <p className="empty-desc">Accounts you block will appear here. You haven't blocked anyone yet.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .empty-blocked-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          text-align: center;
        }
        .empty-icon-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--surface-2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }
        .empty-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .empty-desc {
          font-size: 15px;
          color: var(--text-muted);
          max-width: 260px;
          line-height: 1.5;
        }
        .unblock-btn {
          background: var(--primary-light);
          color: var(--primary);
          border: none;
          padding: 8px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .unblock-btn:hover {
          background: var(--primary);
          color: white;
        }
      `}</style>
    </div>
  );
}
