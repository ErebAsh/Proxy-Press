'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getUnreadMessageCountAction } from '@/lib/actions';
import { OfflineManager } from '@/lib/offline-manager';
import { useIdentity } from '@/lib/IdentityContext';
import './MobileBottomNav.css';

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/explore',
    label: 'Explore',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: '/create',
    label: 'Create',
    isCreate: true,
    icon: (_active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="M8 12h.01" />
        <path d="M12 12h.01" />
        <path d="M16 12h.01" />
      </svg>
    ),
  },

  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [unreadCount, setUnreadCount] = useState(0);
  const [optimisticTab, setOptimisticTab] = useState<string | null>(null);
  const { currentUserId, refreshIdentity } = useIdentity();

  useEffect(() => {
    setOptimisticTab(null);
  }, [pathname]);

  // 1. Static Prefetching (Run once to warm up the cache)
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/explore');
    router.prefetch('/create');
    router.prefetch('/messages');
    router.prefetch('/settings');
    if (currentUserId) router.prefetch(`/profile/${currentUserId}`);
  }, [router, currentUserId]);

  // 2. Background Sync (Lightweight & Non-Blocking)
  useEffect(() => {
    async function backgroundSync() {
      try {
        const actions = await import('@/lib/actions');
        const user = await actions.getCurrentUser();
        
        if (user) {
          refreshIdentity();
          OfflineManager.saveData('last_user_id', user.id);
          
          const count = await actions.getUnreadMessageCountAction();
          setUnreadCount(count);
          
          // Sync profile data in background without blocking UI
          actions.getProfileData(user.id).then(data => {
            if (data) {
              const cacheData = { ...data, timestamp: Date.now() };
              OfflineManager.saveData(`profile_cache_${user.id}`, cacheData);
              // Mirror to localStorage for instant synchronous load on Profile Page
              localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(cacheData));
            }
          });
        }
      } catch (e) {}
    }

    backgroundSync();
    const interval = setInterval(backgroundSync, 30000); // Increased interval for better battery/performance
    return () => clearInterval(interval);
  }, []);

  // 3. UI State Sync
  useEffect(() => {
    getUnreadMessageCountAction().then(setUnreadCount).catch(() => {});
    setOptimisticTab(null);
  }, [pathname]);

  // 4. Navigation Reset Sync Event (Mediator sync pattern)
  useEffect(() => {
    const handleNavigationReset = () => {
      setOptimisticTab(null);
    };
    window.addEventListener('proxy-press-navigation-reset', handleNavigationReset);
    return () => {
      window.removeEventListener('proxy-press-navigation-reset', handleNavigationReset);
    };
  }, []);

  const isStory = searchParams.get('story') === 'true';
  const chatId = searchParams.get('chatId');
  const userId = searchParams.get('userId');
  
  const isMessages = pathname.startsWith('/messages');
  const isSettings = pathname.startsWith('/settings') || pathname.startsWith('/profile/settings');
  const isEditProfile = pathname.startsWith('/profile/edit');
  const isAdmin = pathname.startsWith('/admin');
  const isCalling = searchParams.get('calling') === 'true';
  
  // Hide footer if we are inside a story view, a call, a specific chat, or on settings/admin
  const shouldHide = isStory || isCalling || (isMessages && (chatId || userId)) || isSettings || isEditProfile || isAdmin;

  if (shouldHide) return null;

  return (
    <nav className="mobile-bottom-nav">
      <div className="mobile-nav-container">
        {navItems.map((item) => {
          let href = item.href;
          
          // CRITICAL: Ensure the Profile link is ALWAYS direct and never depends on a slow redirect
          if (href === '/profile') {
            if (currentUserId) {
              href = `/profile/${currentUserId}`;
            }
          }

          const isActive = optimisticTab 
            ? item.href === optimisticTab
            : (item.href === '/' 
              ? pathname === '/' 
              : pathname.startsWith(item.href) || (item.href === '/profile' && pathname.includes('/profile/') && !pathname.includes('/settings')));

          const badge = item.href === '/messages' ? unreadCount : 0;
          
          if (item.isCreate) {
            return (
              <div key={item.href} className="mobile-nav-item mobile-nav-create-wrapper">
                <Link
                  href={href}
                  className="mobile-nav-create-btn"
                >
                  {item.icon(isActive)}
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={href}
              onClick={() => setOptimisticTab(item.href)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="mobile-nav-icon-wrapper">
                {item.icon(isActive)}
                {badge > 0 && !isActive && (
                  <span className="mobile-nav-badge">{badge}</span>
                )}
              </div>
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
