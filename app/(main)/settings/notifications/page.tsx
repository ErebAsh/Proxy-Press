'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../settings.css';

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState({
    push: {
      likes: true,
      comments: true,
      mentions: true,
      newPosts: false,
    }
  });

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    category: 'push' | null;
    key: string | null;
    label: string | null;
    currentValue: boolean;
  }>({
    show: false,
    category: null,
    key: null,
    label: null,
    currentValue: false
  });

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const handleToggleRequest = (category: 'push', key: string, label: string, currentValue: boolean) => {
    setConfirmModal({
      show: true,
      category,
      key,
      label,
      currentValue
    });
  };

  const confirmToggle = () => {
    if (!confirmModal.category || !confirmModal.key) return;

    const { category, key } = confirmModal;
    setSettings(prev => {
      const categoryObj = prev[category] as Record<string, boolean>;
      return {
        ...prev,
        [category]: {
          ...categoryObj,
          [key]: !categoryObj[key]
        }
      };
    });
    setConfirmModal(prev => ({ ...prev, show: false }));
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <Link href="/settings" className="settings-back-btn" aria-label="Go back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="settings-title">Notifications</h1>
      </div>

      <div className="settings-content">
        <div className="settings-group">
          <h2 className="settings-group-title">Push Notifications</h2>
          <div className="settings-list">
            <ToggleItem 
              label="Likes" 
              sub="When someone likes your post" 
              active={settings.push.likes} 
              onToggle={() => handleToggleRequest('push', 'likes', 'Likes', settings.push.likes)} 
            />
            <ToggleItem 
              label="Comments" 
              sub="When someone comments on your post" 
              active={settings.push.comments} 
              onToggle={() => handleToggleRequest('push', 'comments', 'Comments', settings.push.comments)} 
            />
            <ToggleItem 
              label="Mentions" 
              sub="When someone mentions you in a comment" 
              active={settings.push.mentions} 
              onToggle={() => handleToggleRequest('push', 'mentions', 'Mentions', settings.push.mentions)} 
            />
            <ToggleItem 
              label="New Posts" 
              sub="From accounts you follow" 
              active={settings.push.newPosts} 
              onToggle={() => handleToggleRequest('push', 'newPosts', 'New Posts', settings.push.newPosts)} 
            />
          </div>
        </div>
      </div>

      {confirmModal.show && (
        <div className="logout-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <div className="logout-modal-header">
              <div className="logout-modal-icon" style={{ 
                color: confirmModal.currentValue ? '#EF4444' : '#10B981', 
                background: confirmModal.currentValue ? '#FEE2E2' : '#D1FAE5' 
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   {confirmModal.currentValue ? (
                     <path d="M18 6L6 18M6 6l12 12"/>
                   ) : (
                     <polyline points="20 6 9 17 4 12"/>
                   )}
                </svg>
              </div>
              <h2 className="logout-modal-title">
                {confirmModal.currentValue ? `Turn off ${confirmModal.label || ''}?` : `Turn on ${confirmModal.label || ''}?`}
              </h2>
              <p className="logout-modal-desc">
                {confirmModal.currentValue 
                  ? `You will stop receiving ${(confirmModal.label || '').toLowerCase()} notifications on this device.` 
                  : `You will start receiving ${(confirmModal.label || '').toLowerCase()} notifications on this device.`}
              </p>
            </div>
            <div className="logout-modal-actions">
              <button 
                className="logout-confirm-btn" 
                style={{ background: confirmModal.currentValue ? '#EF4444' : 'var(--primary)' }}
                onClick={confirmToggle}
              >
                {confirmModal.currentValue ? 'Turn Off' : 'Turn On'}
              </button>
              <button className="logout-cancel-btn" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleItem({ label, sub, active, onToggle }: { label: string, sub: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="settings-item" onClick={onToggle} style={{ cursor: 'pointer' }}>
      <div className="settings-item-content">
        <div className="settings-item-text">
          <span className="settings-item-label">{label}</span>
          <span className="settings-item-sub">{sub}</span>
        </div>
      </div>
      <div className={`notification-toggle ${active ? 'active' : ''}`}>
        <div className="toggle-thumb" />
      </div>
    </div>
  );
}
