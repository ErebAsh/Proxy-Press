'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import './settings.css';

export default function SettingsPage() {
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const handleLogout = () => {
    router.push('/');
  };

  const settingsItems = [
    {
      group: 'Account',
      items: [
        {
          label: 'Edit Profile',
          sub: 'Change your photo and details',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          ),
          href: '/profile/edit',
        },
        {
          label: 'Privacy',
          sub: 'Manage visibility and data',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ),
          href: '/settings/privacy',
        },
      ],
    },
    {
      group: 'Preferences',
      items: [
        {
          label: 'Notifications',
          sub: 'Configure alerts and sounds',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          ),
          href: '/settings/notifications',
        },
        {
          label: 'About',
          sub: 'Version, terms and licenses',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          ),
          href: '#',
        },
      ],
    },
    {
      group: 'Appearance',
      items: [
        {
          label: 'Theme',
          sub: 'Customize your experience',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ),
          href: '/settings/theme',
        },
      ],
    },
    {
      group: 'System',
      items: [
        {
          label: 'Log Out',
          sub: 'Sign out of your account',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          ),
          onClick: () => setShowLogoutModal(true),
          danger: true,
        },
      ],
    },
  ];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <Link href="/profile" className="settings-back-btn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-content">
        {settingsItems.map((group, idx) => (
          <div key={idx} className="settings-group">
            <h2 className="settings-group-title">{group.group}</h2>
            <div className="settings-list">
              {group.items.map((item, i) => {
                const isLink = !!item.href;
                const Content = (
                  <>
                    <div className="settings-item-content">
                      <div className="settings-item-icon">
                        {item.icon}
                      </div>
                      <div className="settings-item-text">
                        <span className="settings-item-label">{item.label}</span>
                        <span className="settings-item-sub">{item.sub}</span>
                      </div>
                    </div>
                    <div className="settings-chevron">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </>
                );

                return isLink ? (
                  <Link 
                    key={i} 
                    href={item.href!} 
                    className={`settings-item ${item.danger ? 'settings-item-danger' : ''}`}
                  >
                    {Content}
                  </Link>
                ) : (
                  <div 
                    key={i} 
                    onClick={item.onClick}
                    className={`settings-item ${item.danger ? 'settings-item-danger' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {Content}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {showLogoutModal && (
        <div className="logout-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <div className="logout-modal-header">
              <div className="logout-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
              <h2 className="logout-modal-title">Logging Out?</h2>
              <p className="logout-modal-desc">Are you sure you want to log out of your account?</p>
            </div>
            <div className="logout-modal-actions">
              <button className="logout-cancel-btn" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="logout-confirm-btn" onClick={handleLogout}>Log Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
