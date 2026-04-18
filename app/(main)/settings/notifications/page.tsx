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
    },
    email: {
      dailyDigest: true,
      weeklyReport: false,
      securityAlerts: true,
    }
  });

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const toggleSetting = (category: 'push' | 'email', key: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key as keyof typeof prev['push'] | keyof typeof prev['email']]
      }
    }));
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
              onToggle={() => toggleSetting('push', 'likes')} 
            />
            <ToggleItem 
              label="Comments" 
              sub="When someone comments on your post" 
              active={settings.push.comments} 
              onToggle={() => toggleSetting('push', 'comments')} 
            />
            <ToggleItem 
              label="Mentions" 
              sub="When someone mentions you in a comment" 
              active={settings.push.mentions} 
              onToggle={() => toggleSetting('push', 'mentions')} 
            />
            <ToggleItem 
              label="New Posts" 
              sub="From accounts you follow" 
              active={settings.push.newPosts} 
              onToggle={() => toggleSetting('push', 'newPosts')} 
            />
          </div>
        </div>

        <div className="settings-group">
          <h2 className="settings-group-title">Email Notifications</h2>
          <div className="settings-list">
            <ToggleItem 
              label="Daily Digest" 
              sub="A summary of what you missed today" 
              active={settings.email.dailyDigest} 
              onToggle={() => toggleSetting('email', 'dailyDigest')} 
            />
             <ToggleItem 
              label="Security Alerts" 
              sub="Important account activity" 
              active={settings.email.securityAlerts} 
              onToggle={() => toggleSetting('email', 'securityAlerts')} 
            />
          </div>
        </div>
      </div>
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
