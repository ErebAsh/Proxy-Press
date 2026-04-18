'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../../settings.css';

export default function InteractionsSettingsPage() {
  const [interactions, setInteractions] = useState({
    comments: 'Everyone',
    mentions: 'Everyone',
    tags: 'Everyone',
  });

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const options = ['Everyone', 'People You Follow', 'No One'];

  const handleUpdate = (type: keyof typeof interactions, value: string) => {
    setInteractions(prev => ({ ...prev, [type]: value }));
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <Link href="/settings/privacy" className="settings-back-btn" aria-label="Go back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="settings-title">Interactions</h1>
      </div>

      <div className="settings-content">
        <div className="settings-group">
          <h2 className="settings-group-title">Comments</h2>
          <div className="settings-list">
            {options.map(option => (
              <div key={option} className="settings-item" onClick={() => handleUpdate('comments', option)} style={{ cursor: 'pointer' }}>
                <div className="settings-item-content">
                  <div className="settings-item-text">
                    <span className="settings-item-label">{option}</span>
                  </div>
                </div>
                {interactions.comments === option && (
                  <div className="settings-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="settings-info-text">Choose who can comment on your posts.</p>
        </div>

        <div className="settings-group">
          <h2 className="settings-group-title">Mentions</h2>
          <div className="settings-list">
            {options.map(option => (
              <div key={option} className="settings-item" onClick={() => handleUpdate('mentions', option)} style={{ cursor: 'pointer' }}>
                <div className="settings-item-content">
                  <div className="settings-item-text">
                    <span className="settings-item-label">{option}</span>
                  </div>
                </div>
                {interactions.mentions === option && (
                  <div className="settings-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="settings-info-text">Choose who can mention you in their comments or posts.</p>
        </div>
      </div>
      
      <style jsx>{`
        .settings-info-text {
          font-size: 13px;
          color: var(--text-muted);
          padding: 12px 16px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
