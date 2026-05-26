'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout, submitFeedback, getCurrentUser } from '@/lib/actions';
import { useIdentity } from '@/lib/IdentityContext';
import { Suspense } from 'react';
import './settings.css';

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}

let globalInMemoryUser: any = null;
let globalInMemoryUserLoaded = false;

function SettingsContent() {
  const router = useRouter();
  const { currentUserId } = useIdentity();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState('Suggestion');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<any>(() => {
    if (globalInMemoryUserLoaded) {
      return globalInMemoryUser;
    }
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('proxypress_user_data');
      if (cached) {
        try { 
          const parsed = JSON.parse(cached);
          globalInMemoryUser = parsed;
          globalInMemoryUserLoaded = true;
          return parsed; 
        } catch (e) { return null; }
      }
    }
    return null;
  });

  useEffect(() => {
    async function loadUser() {
      const u = await getCurrentUser();
      
      // Only update if data changed to avoid re-renders and make it feel cached
      if (JSON.stringify(u) !== JSON.stringify(globalInMemoryUser)) {
        setUser(u);
        globalInMemoryUser = u;
        globalInMemoryUserLoaded = true;
        if (u && typeof window !== 'undefined') {
          localStorage.setItem('proxypress_user_data', JSON.stringify(u));
        }
      }
    }
    loadUser();

    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const handleLogout = async () => {
    // Clear custom cached profile data in localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('proxypress_user_data');
      localStorage.removeItem('proxypress_viewer_id');
      
      // Programmatically delete all service worker caches
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
          console.log('All Service Worker caches cleared on logout');
        } catch (e) {
          console.error('Failed to clear caches on logout:', e);
        }
      }

      // Hybrid Native (Capacitor) Environment cleanup
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          // 1. Wipe native platform cookies to prevent session leaks
          const { CapacitorCookies } = await import('@capacitor/core');
          await CapacitorCookies.clearAllCookies();
          console.log('Capacitor native cookies cleared successfully');

          // 2. Wipe offline query/feed cache stored in Capacitor Preferences
          const { Preferences } = await import('@capacitor/preferences');
          const keysResult = await Preferences.keys();
          await Promise.all(
            keysResult.keys
              .filter(k => k.startsWith('pp_cache_'))
              .map(k => Preferences.remove({ key: k }))
          );
          console.log('Capacitor offline cache cleared successfully');
        }
      } catch (e) {
        console.error('Failed to clear Capacitor caches/cookies:', e);
      }
    }

    await logout();
    router.push('/login');
    router.refresh();
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;
    
    setIsSubmitting(true);
    try {
      await submitFeedback({ type: feedbackType, message: feedbackMessage });
      setShowSuccess(true);
      setFeedbackMessage('');
      setTimeout(() => {
        setShowSuccess(false);
        setShowFeedbackModal(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
          label: 'Performance',
          sub: 'Optimize navigation and loading speed',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          ),
          href: '/settings/performance',
        },
        {
          label: 'About',
          sub: 'Version, terms and licenses',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          ),
          href: '/settings/about',
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
      group: 'Support',
      items: [
        {
          label: 'Feedback',
          sub: 'Help us improve Proxy-Press',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          ),
          onClick: () => setShowFeedbackModal(true),
        },
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
    ...(user?.role === 'admin' ? [{
      group: 'Administration',
      items: [
        {
          label: 'Admin Portal',
          sub: 'Manage feedback and users',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          ),
          href: '/admin',
        }
      ]
    }] : []),
  ];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <Link 
          href={currentUserId ? `/profile/${currentUserId}` : '/profile'} 
          className="settings-back-btn"
        >
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
                const isLink = 'href' in item;
                const isDanger = 'danger' in item && item.danger;
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
                    href={(item as any).href} 
                    className={`settings-item ${isDanger ? 'settings-item-danger' : ''}`}
                  >
                    {Content}
                  </Link>
                ) : (
                  <div 
                    key={i} 
                    onClick={(item as any).onClick}
                    className={`settings-item ${isDanger ? 'settings-item-danger' : ''}`}
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

      {showFeedbackModal && (
        <div className="feedback-overlay" onClick={() => !isSubmitting && setShowFeedbackModal(false)}>
          <div className="feedback-modal" onClick={e => e.stopPropagation()}>
            {showSuccess ? (
              <div className="feedback-success-state">
                <div className="success-icon-ring">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h2 className="feedback-modal-title">Thank You!</h2>
                <p className="feedback-modal-desc">Your feedback helps us make Proxy-Press better for everyone.</p>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit}>
                <div className="feedback-modal-header">
                  <div className="feedback-modal-icon-bg">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <h2 className="feedback-modal-title">Share Feedback</h2>
                  <p className="feedback-modal-desc">Have a suggestion or found a bug? Let us know!</p>
                </div>

                <div className="feedback-form-content">
                  <div className="feedback-type-selector">
                    {['Suggestion', 'Bug', 'Other'].map(type => (
                      <button
                        key={type}
                        type="button"
                        className={`feedback-type-btn ${feedbackType === type ? 'active' : ''}`}
                        onClick={() => setFeedbackType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="feedback-textarea"
                    placeholder="Tell us what's on your mind..."
                    value={feedbackMessage}
                    onChange={e => setFeedbackMessage(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="feedback-modal-actions">
                  <button 
                    type="button" 
                    className="feedback-cancel-btn" 
                    onClick={() => setShowFeedbackModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="feedback-submit-btn"
                    disabled={isSubmitting || !feedbackMessage.trim()}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
