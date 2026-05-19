'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../settings.css';

export default function PerformanceSettingsPage() {
  const [navLock, setNavLock] = useState(true);
  const [navTimeout, setNavTimeout] = useState(5000);
  const [hoverPrefetch, setHoverPrefetch] = useState(true);
  const [navIndicator, setNavIndicator] = useState('gradient');

  useEffect(() => {
    // 1. Fallback to LocalStorage (Instant)
    const storedLock = localStorage.getItem('proxy-press-nav-lock');
    if (storedLock !== null) setNavLock(storedLock === 'true');

    const storedTimeout = localStorage.getItem('proxy-press-nav-timeout');
    if (storedTimeout !== null) setNavTimeout(parseInt(storedTimeout, 10));

    const storedPrefetch = localStorage.getItem('proxy-press-hover-prefetch');
    if (storedPrefetch !== null) setHoverPrefetch(storedPrefetch === 'true');

    const storedIndicator = localStorage.getItem('proxy-press-nav-indicator');
    if (storedIndicator !== null) setNavIndicator(storedIndicator);

    // 2. Restore from Preferences first (Shared Native Storage)
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.get({ key: 'proxy-press-nav-lock' }).then(({ value }) => {
        if (value !== null) setNavLock(value === 'true');
      });
      Preferences.get({ key: 'proxy-press-nav-timeout' }).then(({ value }) => {
        if (value !== null) setNavTimeout(parseInt(value, 10));
      });
      Preferences.get({ key: 'proxy-press-hover-prefetch' }).then(({ value }) => {
        if (value !== null) setHoverPrefetch(value === 'true');
      });
      Preferences.get({ key: 'proxy-press-nav-indicator' }).then(({ value }) => {
        if (value !== null) setNavIndicator(value);
      });
    }).catch(() => {});

    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  const triggerStorageUpdate = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('proxy-press-settings-updated'));
    }
  };

  const handleLockToggle = (enabled: boolean) => {
    setNavLock(enabled);
    localStorage.setItem('proxy-press-nav-lock', String(enabled));
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.set({ key: 'proxy-press-nav-lock', value: String(enabled) });
    }).catch(() => {});
    triggerStorageUpdate();
  };

  const handleTimeoutChange = (timeout: number) => {
    setNavTimeout(timeout);
    localStorage.setItem('proxy-press-nav-timeout', String(timeout));
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.set({ key: 'proxy-press-nav-timeout', value: String(timeout) });
    }).catch(() => {});
    triggerStorageUpdate();
  };

  const handlePrefetchToggle = (enabled: boolean) => {
    setHoverPrefetch(enabled);
    localStorage.setItem('proxy-press-hover-prefetch', String(enabled));
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.set({ key: 'proxy-press-hover-prefetch', value: String(enabled) });
    }).catch(() => {});
    triggerStorageUpdate();
  };

  const handleIndicatorChange = (style: string) => {
    setNavIndicator(style);
    localStorage.setItem('proxy-press-nav-indicator', style);
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.set({ key: 'proxy-press-nav-indicator', value: style });
    }).catch(() => {});
    triggerStorageUpdate();
  };

  const timeoutOptions = [
    { label: 'Instant (No Lock)', value: 0, desc: 'Highest speed, but no double-tap prevention' },
    { label: 'Fast (3s Limit)', value: 3000, desc: 'Speedy recovery for modern devices' },
    { label: 'Standard (5s Limit)', value: 5000, desc: 'Perfect balance of safety and response' },
    { label: 'Ultra Safe (10s Limit)', value: 10000, desc: 'Great for extremely slow connections' },
  ];

  const indicatorOptions = [
    { id: 'gradient', label: 'Premium Glow Bar', preview: 'linear-gradient(90deg, #2563EB, #8B5CF6, #EF4444)' },
    { id: 'oled', label: 'OLED Minimalist', preview: 'var(--text-primary)' },
    { id: 'none', label: 'Hidden Indicator', preview: 'transparent' },
  ];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <Link href="/settings" className="settings-back-btn" aria-label="Go back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="settings-title">Performance Settings</h1>
      </div>

      <div className="settings-content">
        {/* Rendering Engine Section */}
        <div className="settings-group">
          <h2 className="settings-group-title">Rendering & Speed Boosters</h2>
          <div className="settings-list">
            <div className="settings-item">
              <div className="settings-item-content">
                <div className="settings-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <div className="settings-item-text">
                  <span className="settings-item-label">Hover-to-Preload</span>
                  <span className="settings-item-sub">Prefetch pages on hover or touch start</span>
                </div>
              </div>
              <div 
                className={`notification-toggle ${hoverPrefetch ? 'active' : ''}`}
                onClick={() => handlePrefetchToggle(!hoverPrefetch)}
                style={{ cursor: 'pointer' }}
              >
                <div className="toggle-thumb" />
              </div>
            </div>
          </div>
          <p className="performance-tip">
            💡 <b>How it works:</b> Mouse movements or touch inputs trigger dynamic page prefetching 100ms - 300ms before a click completes, loading data preemptively to render targets instantly.
          </p>
        </div>

        {/* Navigation Lock Configuration */}
        <div className="settings-group">
          <h2 className="settings-group-title">Navigation Flow Guard</h2>
          <div className="settings-list">
            <div className="settings-item">
              <div className="settings-item-content">
                <div className="settings-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div className="settings-item-text">
                  <span className="settings-item-label">Anti-Duplicate Navigation Lock</span>
                  <span className="settings-item-sub">Block parallel clicks during page load</span>
                </div>
              </div>
              <div 
                className={`notification-toggle ${navLock ? 'active' : ''}`}
                onClick={() => handleLockToggle(!navLock)}
                style={{ cursor: 'pointer' }}
              >
                <div className="toggle-thumb" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Safety Timeout Options */}
        {navLock && (
          <div className="settings-group">
            <h2 className="settings-group-title">Safety Recovery Timeout</h2>
            <div className="settings-list">
              {timeoutOptions.map((opt) => (
                <div 
                  key={opt.value} 
                  className="settings-item timeout-option-item"
                  onClick={() => handleTimeoutChange(opt.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="settings-item-content">
                    <div className="timeout-selector-radio">
                      <div className={`radio-dot ${navTimeout === opt.value ? 'selected' : ''}`} />
                    </div>
                    <div className="settings-item-text">
                      <span className="settings-item-label">{opt.label}</span>
                      <span className="settings-item-sub">{opt.desc}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="performance-tip">
              ⚠️ Prevents permanently locked navigation. If a page transition hangs, the guard will unlock after the selected time.
            </p>
          </div>
        )}

        {/* Visual Progress Indicator */}
        <div className="settings-group">
          <h2 className="settings-group-title">Loading Progress Aesthetics</h2>
          <div className="indicator-presets-grid">
            {indicatorOptions.map((style) => (
              <button 
                key={style.id}
                className={`preset-card indicator-card ${navIndicator === style.id ? 'active' : ''}`}
                onClick={() => handleIndicatorChange(style.id)}
              >
                <div 
                  className="indicator-preview-bar"
                  style={{ background: style.preview }}
                />
                <span className="indicator-card-label">{style.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            System configurations are optimized and applied in real-time.
          </p>
        </div>
      </div>

      <style jsx>{`
        .performance-tip {
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-muted);
          padding: 12px 16px;
          margin-top: 8px;
        }
        .timeout-selector-radio {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 4px;
        }
        .radio-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: transparent;
          transition: background-color 0.2s;
        }
        .radio-dot.selected {
          background: var(--primary);
        }
        .timeout-option-item:hover .timeout-selector-radio {
          border-color: var(--primary);
        }
        .indicator-presets-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 8px 16px;
        }
        .indicator-card {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: 16px;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .indicator-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        .indicator-card.active {
          border-color: var(--primary);
          background: var(--surface-2);
          box-shadow: 0 0 0 3px var(--primary-light);
        }
        .indicator-preview-bar {
          width: 100%;
          height: 4px;
          border-radius: 2px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        .indicator-card-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          text-align: center;
        }
        @media (max-width: 480px) {
          .indicator-presets-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
