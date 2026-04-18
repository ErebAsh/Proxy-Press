'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../settings.css';

export default function PrivacySettingsPage() {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [privacy, setPrivacy] = useState({
    account: {
      privateAccount: false,
      activityStatus: true,
    },
    interactions: {
      mentions: 'Everyone',
      comments: 'Everyone',
      tags: 'Everyone',
    },
    data: {
      personalizedAds: true,
      downloadData: false,
    }
  });

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const toggleSetting = (category: 'account' | 'data', key: string) => {
    if (key === 'privateAccount') {
      setShowConfirmModal(true);
      return;
    }
    setPrivacy(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key as keyof typeof prev['account'] | keyof typeof prev['data']]
      }
    }));
  };

  const confirmTogglePrivate = () => {
    setPrivacy(prev => ({
      ...prev,
      account: {
        ...prev.account,
        privateAccount: !prev.account.privateAccount
      }
    }));
    setShowConfirmModal(false);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <Link href="/settings" className="settings-back-btn" aria-label="Go back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="settings-title">Privacy</h1>
      </div>

      <div className="settings-content">
        <div className="settings-group">
          <h2 className="settings-group-title">Account Privacy</h2>
          <div className="settings-list">
            <ToggleItem 
              label="Private Account" 
              sub="Only people you approve can see your posts" 
              active={privacy.account.privateAccount} 
              onToggle={() => toggleSetting('account', 'privateAccount')} 
            />
            <ToggleItem 
              label="Show Activity Status" 
              sub="Allow accounts you follow to see when you're active" 
              active={privacy.account.activityStatus} 
              onToggle={() => toggleSetting('account', 'activityStatus')} 
            />
          </div>
        </div>

        {/* ... Rest of settings same as before */}
        <div className="settings-group">
          <h2 className="settings-group-title">Interactions</h2>
          <div className="settings-list">
             <LinkItem label="Comments" value={privacy.interactions.comments} />
             <LinkItem label="Mentions" value={privacy.interactions.mentions} />
             <LinkItem label="Blocked Accounts" value="0 Users" />
          </div>
        </div>

        <div className="settings-group">
          <h2 className="settings-group-title">Personal Data</h2>
          <div className="settings-list">
            <ToggleItem 
              label="Personalized Ads" 
              sub="Show ads based on your interests" 
              active={privacy.data.personalizedAds} 
              onToggle={() => toggleSetting('data', 'personalizedAds')} 
            />
            <div className="settings-item" style={{ cursor: 'pointer' }}>
                <div className="settings-item-content">
                  <div className="settings-item-text">
                    <span className="settings-item-label" style={{ color: 'var(--primary)', fontWeight: 700 }}>Download My Data</span>
                    <span className="settings-item-sub">Request a copy of your information</span>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="logout-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <div className="logout-modal-header">
              <div className="logout-modal-icon" style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h2 className="logout-modal-title">
                {privacy.account.privateAccount ? 'Make Account Public?' : 'Make Account Private?'}
              </h2>
              <p className="logout-modal-desc">
                {privacy.account.privateAccount 
                  ? 'Anyone will be able to see your posts and follow you without approval.' 
                  : 'Only people you approve will be able to see your posts and followers.'}
              </p>
            </div>
            <div className="logout-modal-actions">
              <button 
                className="logout-confirm-btn" 
                style={{ background: 'var(--primary)' }}
                onClick={confirmTogglePrivate}
              >
                {privacy.account.privateAccount ? 'Make Public' : 'Switch to Private'}
              </button>
              <button className="logout-cancel-btn" onClick={() => setShowConfirmModal(false)}>Not Now</button>
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

function LinkItem({ label, value }: { label: string, value: string }) {
    return (
      <div className="settings-item" style={{ cursor: 'pointer' }}>
        <div className="settings-item-content">
          <div className="settings-item-text">
            <span className="settings-item-label">{label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{value}</span>
            <div className="settings-chevron">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        </div>
      </div>
    );
}
