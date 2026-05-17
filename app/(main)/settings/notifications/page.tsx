'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../settings.css';
import { getCurrentUser, updateUserNotificationSettings } from '@/lib/actions';

interface NotificationSettings {
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyMentions: boolean;
  notifyNewPosts: boolean;
  notifyMessages: boolean;
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('proxypress_notification_settings');
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    }
    return {
      notifyLikes: true,
      notifyComments: true,
      notifyMentions: true,
      notifyNewPosts: false,
      notifyMessages: true,
    } as NotificationSettings;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('proxypress_notification_settings');
    }
    return true;
  });
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    key: keyof NotificationSettings | null;
    label: string;
    currentValue: boolean;
  }>({
    show: false,
    key: null,
    label: '',
    currentValue: false
  });

  useEffect(() => {
    async function loadSettings() {
      const user = await getCurrentUser();
      if (user) {
        const newSettings = {
          notifyLikes: user.notifyLikes ?? true,
          notifyComments: user.notifyComments ?? true,
          notifyMentions: user.notifyMentions ?? true,
          notifyNewPosts: user.notifyNewPosts ?? false,
          notifyMessages: user.notifyMessages ?? true,
        };
        setSettings(newSettings);
        if (typeof window !== 'undefined') {
          localStorage.setItem('proxypress_notification_settings', JSON.stringify(newSettings));
        }
      }
      setLoading(false);
    }
    loadSettings();

    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const handleToggleRequest = (key: keyof NotificationSettings, label: string) => {
    setConfirmModal({
      show: true,
      key,
      label,
      currentValue: settings[key]
    });
  };

  const confirmToggle = async () => {
    if (!confirmModal.key) return;
    const key = confirmModal.key;
    const newSettings = { ...settings, [key]: !settings[key] };
    
    setSettings(newSettings);
    setConfirmModal(prev => ({ ...prev, show: false }));

    try {
      const res = await updateUserNotificationSettings(newSettings);
      if (!res.success) {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
      }
    } catch (err) {
      setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };



  return (
    <div className="settings-container" style={{ animation: 'none' }}>
      <div className="settings-header" style={{ padding: '16px 0' }}>
        <Link href="/settings" className="settings-back-btn" aria-label="Go back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="settings-title" style={{ fontSize: '24px' }}>Notifications</h1>
      </div>

      <div className="settings-content">
        <div className="settings-group">
          <h2 className="settings-group-title" style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '10px' }}>PUSH NOTIFICATIONS</h2>
          <div className="settings-list" style={{ borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
            <ToggleItem 
              label="Likes" 
              sub="When someone likes your post" 
              active={settings.notifyLikes} 
              onToggle={() => handleToggleRequest('notifyLikes', 'Likes')} 
            />
            <ToggleItem 
              label="Comments" 
              sub="When someone comments on your post" 
              active={settings.notifyComments} 
              onToggle={() => handleToggleRequest('notifyComments', 'Comments')} 
            />
            <ToggleItem 
              label="Mentions" 
              sub="When someone mentions you in a comment" 
              active={settings.notifyMentions} 
              onToggle={() => handleToggleRequest('notifyMentions', 'Mentions')} 
            />
            <ToggleItem 
              label="New Posts" 
              sub="From accounts you follow" 
              active={settings.notifyNewPosts} 
              onToggle={() => handleToggleRequest('notifyNewPosts', 'New Posts')} 
            />
            <ToggleItem 
              label="Messages" 
              sub="When someone sends you a message" 
              active={settings.notifyMessages} 
              onToggle={() => handleToggleRequest('notifyMessages', 'Messages')} 
            />
          </div>
        </div>
      </div>

      {confirmModal.show && (
        <div className="logout-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <div className="logout-modal-header" style={{ padding: '24px 20px 16px' }}>
              <div className="logout-modal-icon" style={{ 
                color: confirmModal.currentValue ? '#EF4444' : '#3B82F6', 
                background: confirmModal.currentValue ? '#FEE2E2' : '#DBEAFE',
                width: '48px', height: '48px', borderRadius: '16px'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   {confirmModal.currentValue ? (
                     <path d="M18 6L6 18M6 6l12 12"/>
                   ) : (
                     <polyline points="20 6 9 17 4 12"/>
                   )}
                </svg>
              </div>
              <h2 className="logout-modal-title" style={{ fontSize: '18px' }}>
                {confirmModal.currentValue ? `Turn off ${confirmModal.label}?` : `Turn on ${confirmModal.label}?`}
              </h2>
              <p className="logout-modal-desc" style={{ fontSize: '13px' }}>
                Are you sure you want to change your {confirmModal.label.toLowerCase()} notification status?
              </p>
            </div>
            <div className="logout-modal-actions" style={{ padding: '0 12px 12px' }}>
              <button 
                className="logout-confirm-btn" 
                style={{ 
                  background: confirmModal.currentValue ? '#EF4444' : '#3B82F6',
                  padding: '12px', borderRadius: '12px', fontSize: '14px'
                }}
                onClick={confirmToggle}
              >
                {confirmModal.currentValue ? 'Turn Off' : 'Turn On'}
              </button>
              <button 
                className="logout-cancel-btn" 
                style={{ padding: '12px', fontSize: '14px' }}
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              >
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
    <div className="settings-item" onClick={onToggle} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
      <div className="settings-item-content">
        <div className="settings-item-text">
          <span className="settings-item-label" style={{ fontSize: '16px', fontWeight: '700' }}>{label}</span>
          <span className="settings-item-sub" style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>{sub}</span>
        </div>
      </div>
      <div className={`notification-toggle ${active ? 'active' : ''}`} style={{ 
        width: '44px', 
        height: '24px', 
        background: active ? '#3B82F6' : '#374151',
        borderRadius: '24px'
      }}>
        <div className="toggle-thumb" style={{ 
          width: '18px', 
          height: '18px', 
          left: active ? '23px' : '3px',
          top: '3px'
        }} />
      </div>
    </div>
  );
}

