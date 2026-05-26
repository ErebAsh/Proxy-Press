'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

function SafeNavigationGuardInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Track timestamps and URLs to enforce navigation lock
  const lastNavTime = useRef<number>(0);
  const pendingUrl = useRef<string | null>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const fadeOutTimer = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimer = useRef<NodeJS.Timeout | null>(null);
  // Generation counter: incremented on each new navigation to discard stale completions
  const navGeneration = useRef<number>(0);

  // Swipe Back Gesture Elements
  const swipeIndicatorRef = useRef<HTMLDivElement | null>(null);

  // Performance Settings Configuration
  const [navLockEnabled, setNavLockEnabled] = useState(true);
  const [navTimeout, setNavTimeout] = useState(5000); // 5s default safety timeout
  const [hoverPrefetchEnabled, setHoverPrefetchEnabled] = useState(true);
  const [navIndicator, setNavIndicator] = useState('gradient');

  // Swipe Back Gesture Logic
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isTracking = false;
    const edgeThreshold = 30; // px from left edge
    const minSwipeDistance = 80; // px needed to trigger back navigation
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      
      // Only initiate swipe if close to the left edge
      if (touch.clientX < edgeThreshold) {
        startX = touch.clientX;
        startY = touch.clientY;
        isTracking = true;
        
        // Show indicator
        if (swipeIndicatorRef.current) {
          swipeIndicatorRef.current.style.transition = 'none';
          swipeIndicatorRef.current.style.transform = 'translateY(-50%) translateX(-100%) scale(0.8)';
          swipeIndicatorRef.current.style.opacity = '0';
          swipeIndicatorRef.current.style.display = 'flex';
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);
      
      // If user is swiping vertically, abort
      if (deltaY > deltaX && deltaX < 20) {
        isTracking = false;
        if (swipeIndicatorRef.current) {
          swipeIndicatorRef.current.style.display = 'none';
        }
        return;
      }
      
      if (deltaX > 0) {
        // Prevent scrolling while swiping back
        if (e.cancelable) {
          e.preventDefault();
        }
        
        // Calculate progress (0 to 1) towards the threshold
        const progress = Math.min(deltaX / minSwipeDistance, 1.5);
        
        // Apply springy resistance past the threshold
        let pull = deltaX;
        if (deltaX > minSwipeDistance) {
          const extra = deltaX - minSwipeDistance;
          pull = minSwipeDistance + extra * 0.4;
        }
        
        // Update indicator visual representation
        if (swipeIndicatorRef.current) {
          const scale = 0.8 + Math.min(progress * 0.3, 0.4);
          const opacity = Math.min(progress * 0.9, 0.95);
          // Pull indicator out from left edge (sliding from -50px start position)
          const tx = Math.min(pull - 50, 40);
          swipeIndicatorRef.current.style.transform = `translateY(-50%) translateX(${tx}px) scale(${scale})`;
          swipeIndicatorRef.current.style.opacity = `${opacity}`;
          
          // Color change on crossing threshold
          if (deltaX >= minSwipeDistance) {
            swipeIndicatorRef.current.classList.add('ready');
          } else {
            swipeIndicatorRef.current.classList.remove('ready');
          }
        }
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTracking) return;
      isTracking = false;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      
      if (swipeIndicatorRef.current) {
        swipeIndicatorRef.current.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s';
        
        if (deltaX >= minSwipeDistance) {
          // Trigger Back Navigation!
          swipeIndicatorRef.current.style.transform = 'translateY(-50%) translateX(100px) scale(1.3)';
          swipeIndicatorRef.current.style.opacity = '0';
          setTimeout(() => {
            if (swipeIndicatorRef.current) swipeIndicatorRef.current.style.display = 'none';
          }, 250);
          
          window.history.back();
        } else {
          // Reset indicator with a smooth spring bounce
          swipeIndicatorRef.current.style.transform = 'translateY(-50%) translateX(-100%) scale(0.8)';
          swipeIndicatorRef.current.style.opacity = '0';
          setTimeout(() => {
            if (swipeIndicatorRef.current) swipeIndicatorRef.current.style.display = 'none';
          }, 250);
        }
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Sync settings from localStorage and Capacitor preferences
  useEffect(() => {
    const loadSettings = () => {
      const storedLock = localStorage.getItem('proxy-press-nav-lock');
      if (storedLock !== null) {
        setNavLockEnabled(storedLock === 'true');
      } else {
        setNavLockEnabled(true);
      }

      const storedTimeout = localStorage.getItem('proxy-press-nav-timeout');
      if (storedTimeout !== null) {
        setNavTimeout(parseInt(storedTimeout, 10));
      } else {
        setNavTimeout(5000);
      }

      const storedPrefetch = localStorage.getItem('proxy-press-hover-prefetch');
      if (storedPrefetch !== null) {
        setHoverPrefetchEnabled(storedPrefetch === 'true');
      } else {
        setHoverPrefetchEnabled(true);
      }

      const storedIndicator = localStorage.getItem('proxy-press-nav-indicator');
      if (storedIndicator !== null) {
        setNavIndicator(storedIndicator);
      } else {
        setNavIndicator('gradient');
      }
    };

    loadSettings();

    // Support hybrid storage via Capacitor Preferences
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.get({ key: 'proxy-press-nav-lock' }).then(({ value }) => {
        if (value !== null) setNavLockEnabled(value === 'true');
      });
      Preferences.get({ key: 'proxy-press-nav-timeout' }).then(({ value }) => {
        if (value !== null) setNavTimeout(parseInt(value, 10));
      });
      Preferences.get({ key: 'proxy-press-hover-prefetch' }).then(({ value }) => {
        if (value !== null) setHoverPrefetchEnabled(value === 'true');
      });
      Preferences.get({ key: 'proxy-press-nav-indicator' }).then(({ value }) => {
        if (value !== null) setNavIndicator(value);
      });
    }).catch(() => {});

    // Listen for custom settings storage events to update real-time
    const handleStorageChange = () => {
      loadSettings();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('proxy-press-settings-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('proxy-press-settings-updated', handleStorageChange);
    };
  }, []);

  // Helper: clean up all running timers
  const cleanupTimers = () => {
    if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
    if (fadeOutTimer.current) { clearTimeout(fadeOutTimer.current); fadeOutTimer.current = null; }
    if (timeoutTimer.current) { clearTimeout(timeoutTimer.current); timeoutTimer.current = null; }
  };

  // Helper: complete navigation UI (progress bar fill + fade out)
  const completeNavigation = (gen: number) => {
    // Ignore if a newer navigation has started since this was queued
    if (gen !== navGeneration.current) return;

    cleanupTimers();
    setProgress(100);
    
    fadeOutTimer.current = setTimeout(() => {
      if (gen !== navGeneration.current) return;
      setNavigating(false);
      setProgress(0);
      pendingUrl.current = null;
    }, 200);
  };

  // Complete navigation ONLY when the arrived pathname matches what we were navigating to.
  // This is the critical fix: previously ANY pathname change was treated as "navigation complete"
  // which caused a page B response to be misinterpreted as completing a navigation to page A.
  useEffect(() => {
    if (!pendingUrl.current) return;

    // Normalize both URLs for comparison (strip trailing slashes, ignore query params for matching)
    const normalize = (url: string) => {
      try {
        const u = new URL(url, window.location.origin);
        return u.pathname.replace(/\/+$/, '') || '/';
      } catch {
        return url.replace(/\/+$/, '') || '/';
      }
    };

    const pendingPath = normalize(pendingUrl.current);
    const arrivedPath = normalize(pathname);

    if (arrivedPath === pendingPath) {
      // The correct page has arrived — complete the navigation
      completeNavigation(navGeneration.current);
    }
    // If arrivedPath !== pendingPath, do NOT clear pendingUrl.
    // The pending navigation is still in-flight or was superseded.
    
    return () => {
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
    };
  }, [pathname, searchParams]);

  // Helper: start a new navigation tracking cycle
  const startNavigationTracking = (href: string) => {
    // Increment generation to invalidate any pending completion from a prior navigation
    navGeneration.current += 1;
    const gen = navGeneration.current;

    cleanupTimers();

    lastNavTime.current = Date.now();
    pendingUrl.current = href;
    setNavigating(true);
    setProgress(10);

    // Increment progress bar naturally
    progressTimer.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        const increment = Math.max(1, (90 - prev) * 0.15);
        return Math.min(90, prev + increment);
      });
    }, 100);

    // Safety timeout to prevent permanent deadlocks
    if (navTimeout > 0) {
      timeoutTimer.current = setTimeout(() => {
        if (gen !== navGeneration.current) return;
        console.warn(`[SafeNavigation] Transition to "${href}" timed out after ${navTimeout}ms. Resetting.`);
        cleanupTimers();
        setProgress(100);
        fadeOutTimer.current = setTimeout(() => {
          if (gen !== navGeneration.current) return;
          setNavigating(false);
          setProgress(0);
          pendingUrl.current = null;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('proxy-press-navigation-reset'));
          }
        }, 200);
      }, navTimeout);
    }
  };

  // Intercept clicks globally in the capture phase
  useEffect(() => {
    const handleCaptureClick = (event: MouseEvent) => {
      // Find the closest anchor tag
      const link = (event.target as HTMLElement).closest('a');
      
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Ignore external links, mailto, tel, anchor hashes, downloads
      const isInternal = href.startsWith('/') || href.startsWith(window.location.origin);
      if (!isInternal) return;

      if (href.startsWith('#') || link.hasAttribute('download')) return;

      const normalize = (url: string) => {
        try {
          const u = new URL(url, window.location.origin);
          return u.pathname.replace(/\/+$/, '') || '/';
        } catch {
          return url.replace(/\/+$/, '') || '/';
        }
      };

      const targetPath = normalize(href);
      const currentPath = normalize(window.location.pathname);

      // Rule 0: Skip loading bar if clicking a link to the current active page
      if (targetPath === currentPath) {
        return;
      }

      const now = Date.now();
      const timeSinceLastNav = now - lastNavTime.current;

      // Rule 1: Prevent rapid repeated taps on the SAME link (within 250ms)
      // Only block identical consecutive clicks — tapping different buttons/links is always allowed
      if (pendingUrl.current === href && timeSinceLastNav < 250) {
        console.log('[SafeNavigation] Throttled rapid duplicate tap:', href);
        event.preventDefault();
        return;
      }

      // Rule 3: Stuck Transition Escape Hatch
      // If the user clicks the SAME link again after 1.2s of it being pending/stuck,
      // force-navigate to it. Uses router.push (not replace) to ensure it wins the race.
      if (pendingUrl.current === href && timeSinceLastNav > 1200) {
        console.warn(`[SafeNavigation] Transition to "${href}" is stuck. Forcing navigation.`);
        
        // Cancel the old tracking and start fresh
        startNavigationTracking(href);
        
        // Dispatch navigation reset event to clear optimistic UI highlights
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('proxy-press-navigation-reset'));
        }

        // Force navigate — use window.location as an absolute guarantee
        event.preventDefault();
        event.stopPropagation();
        
        try {
          router.push(href);
        } catch {
          window.location.href = href;
        }
        return;
      }

      // Rule 2: If a different navigation is already pending, cancel it and start the new one
      if (navLockEnabled && pendingUrl.current && pendingUrl.current !== href) {
        console.log(`[SafeNavigation] Overriding pending "${pendingUrl.current}" → "${href}"`);
      }

      // Start tracking the new navigation (this also cancels any prior pending state)
      startNavigationTracking(href);
      // Allow the click to proceed to Next.js Link handler
    };

    // Add listener to the capture phase (third arg: true)
    document.addEventListener('click', handleCaptureClick, true);

    return () => {
      document.removeEventListener('click', handleCaptureClick, true);
      cleanupTimers();
    };
  }, [navLockEnabled, navTimeout]);

  // Hover & Touch Prefetching with 80ms Debounce to prevent queue congestion
  useEffect(() => {
    if (!hoverPrefetchEnabled) return;

    const prefetchedPaths = new Set<string>();
    let prefetchTimeout: NodeJS.Timeout | null = null;

    const handleHoverOrTouch = (event: Event) => {
      const link = (event.target as HTMLElement).closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Ignore external, hash, tel, mailto, downloads
      const isInternal = href.startsWith('/') || href.startsWith(window.location.origin);
      if (!isInternal) return;

      if (href.startsWith('#') || link.hasAttribute('download')) return;

      // Avoid double prefetching the same path
      if (prefetchedPaths.has(href)) return;

      // Clear any pending prefetch to prevent multiple quick triggers
      if (prefetchTimeout) clearTimeout(prefetchTimeout);

      // Debounce prefetch by 80ms: only fetch if hovered/touched for a moment
      prefetchTimeout = setTimeout(() => {
        prefetchedPaths.add(href);
        try {
          router.prefetch(href);
          console.log(`[SafeNavigation] Debounced prefetch completed for: ${href}`);
        } catch (err) {
          console.error('[SafeNavigation] Debounced prefetch failed:', err);
        }
      }, 80);
    };

    const handleLeave = () => {
      if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
        prefetchTimeout = null;
      }
    };

    document.addEventListener('mouseover', handleHoverOrTouch, { passive: true });
    document.addEventListener('touchstart', handleHoverOrTouch, { passive: true });
    document.addEventListener('mouseout', handleLeave, { passive: true });
    document.addEventListener('touchend', handleLeave, { passive: true });

    return () => {
      document.removeEventListener('mouseover', handleHoverOrTouch);
      document.removeEventListener('touchstart', handleHoverOrTouch);
      document.removeEventListener('mouseout', handleLeave);
      document.removeEventListener('touchend', handleLeave);
      if (prefetchTimeout) clearTimeout(prefetchTimeout);
    };
  }, [hoverPrefetchEnabled, router]);

  const isOled = navIndicator === 'oled';
  const showNavBar = navigating && navIndicator !== 'none';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .swipe-back-indicator {
          position: fixed;
          left: -40px;
          top: 50%;
          transform: translateY(-50%) translateX(-100%) scale(0.8);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1.5px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          color: #FFFFFF;
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          pointer-events: none;
          transition: background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
        }
        .dark .swipe-back-indicator {
          background: rgba(15, 23, 42, 0.6);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          color: #F8FAFC;
        }
        .swipe-back-indicator.ready {
          background: #2563EB;
          border-color: #3B82F6;
          color: #FFFFFF;
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.45);
        }
        
        .safe-nav-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: ${isOled ? 'var(--text-primary)' : 'linear-gradient(90deg, #2563EB 0%, #8B5CF6 50%, #EF4444 100%)'};
          box-shadow: ${isOled ? 'none' : '0 1px 10px rgba(139, 92, 246, 0.5)'};
          z-index: 99999;
          transform-origin: left;
          transition: transform 300ms cubic-bezier(0.1, 0.8, 0.1, 1), opacity 300ms ease;
          pointer-events: none;
        }
        .safe-nav-glow {
          position: absolute;
          right: 0;
          width: 100px;
          height: 100%;
          background: ${isOled ? 'linear-gradient(90deg, transparent, var(--surface))' : 'linear-gradient(90deg, transparent, #FFFFFF)'};
          box-shadow: ${isOled ? 'none' : '0 0 10px #FFFFFF, 0 0 5px #8B5CF6'};
          opacity: 0.8;
          animation: safe-nav-pulse 1.2s infinite;
        }
        @keyframes safe-nav-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}} />
      
      <div 
        ref={swipeIndicatorRef}
        className="swipe-back-indicator"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </div>

      {showNavBar && (
        <div 
          className="safe-nav-bar" 
          style={{ 
            transform: `scaleX(${progress / 100})`,
            opacity: progress === 100 ? 0 : 1
          }}
        >
          <div className="safe-nav-glow" />
        </div>
      )}
    </>
  );
}

export default function SafeNavigationGuard() {
  return (
    <Suspense fallback={null}>
      <SafeNavigationGuardInner />
    </Suspense>
  );
}
