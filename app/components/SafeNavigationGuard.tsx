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

  // Performance Settings Configuration
  const [navLockEnabled, setNavLockEnabled] = useState(true);
  const [navTimeout, setNavTimeout] = useState(5000); // 5s default safety timeout
  const [hoverPrefetchEnabled, setHoverPrefetchEnabled] = useState(true);
  const [navIndicator, setNavIndicator] = useState('gradient');

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

  // Complete navigation when pathname or searchParams change
  useEffect(() => {
    if (pendingUrl.current) {
      // Clear safety timeout
      if (timeoutTimer.current) {
        clearTimeout(timeoutTimer.current);
        timeoutTimer.current = null;
      }

      // Set to 100% complete
      setProgress(100);
      
      // Stop the incremental progress
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      
      // Fade out after completion
      fadeOutTimer.current = setTimeout(() => {
        setNavigating(false);
        setProgress(0);
        pendingUrl.current = null;
      }, 300);
    }
    
    return () => {
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
    };
  }, [pathname, searchParams]);

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

      const now = Date.now();
      const timeSinceLastNav = now - lastNavTime.current;

      // Rule 1: Prevent double-click or rapid double-tap (within 600ms)
      if (timeSinceLastNav < 600) {
        console.log('[SafeNavigation] Throttled rapid duplicate click:', href);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Rule 3: Stuck Transition Escape Hatch
      // If the user clicks the SAME link again after 1.2 seconds of it being pending/stuck,
      // trigger an active programmatic override to bypass Next.js internal router freezes.
      if (pendingUrl.current === href && timeSinceLastNav > 1200) {
        console.warn(`[SafeNavigation] Transition to "${href}" is stuck. Triggering escape hatch programmatic redirect.`);
        
        // Reset states
        pendingUrl.current = null;
        setNavigating(false);
        setProgress(0);
        if (progressTimer.current) clearInterval(progressTimer.current);
        if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
        
        // Dispatch navigation reset event to clear optimistic UI highlights
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('proxy-press-navigation-reset'));
        }

        // Programmatic redirect to guarantee the page opens
        try {
          router.replace(href);
        } catch {
          window.location.href = href;
        }

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Rule 2: Allow seamless override of pending navigations instead of hard-blocking
      if (navLockEnabled && pendingUrl.current && pendingUrl.current !== href) {
        console.log(`[SafeNavigation] Overriding pending navigation to "${pendingUrl.current}" with new destination: "${href}"`);
        pendingUrl.current = href;
        lastNavTime.current = now;
        
        // Reset progress animation to restart for the new route
        if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
        if (progressTimer.current) clearInterval(progressTimer.current);
        if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
        
        setNavigating(true);
        setProgress(10);
        
        progressTimer.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return 90;
            const increment = Math.max(1, (90 - prev) * 0.15);
            return Math.min(90, prev + increment);
          });
        }, 100);

        if (navTimeout > 0) {
          timeoutTimer.current = setTimeout(() => {
            console.warn(`[SafeNavigation] Page transition to "${href}" timed out after ${navTimeout}ms. Resetting lock.`);
            setProgress(100);
            
            if (progressTimer.current) {
              clearInterval(progressTimer.current);
              progressTimer.current = null;
            }

            fadeOutTimer.current = setTimeout(() => {
              setNavigating(false);
              setProgress(0);
              pendingUrl.current = null;
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('proxy-press-navigation-reset'));
              }
            }, 300);
          }, navTimeout);
        }
        
        return; // Allow the click to proceed
      }

      // Allow navigation: Update lock states
      lastNavTime.current = now;
      pendingUrl.current = href;
      
      // Trigger progress bar animations
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      
      setNavigating(true);
      setProgress(10); // Start at 10%
      
      // Increment progress bar naturally
      progressTimer.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            // Cap at 90% until transition finishes
            return 90;
          }
          // Slow down as it gets closer to 90%
          const increment = Math.max(1, (90 - prev) * 0.15);
          return Math.min(90, prev + increment);
        });
      }, 100);

      // Start safety timeout to prevent permanent deadlocks
      if (navTimeout > 0) {
        timeoutTimer.current = setTimeout(() => {
          console.warn(`[SafeNavigation] Page transition to "${href}" timed out after ${navTimeout}ms. Resetting lock.`);
          setProgress(100);
          
          if (progressTimer.current) {
            clearInterval(progressTimer.current);
            progressTimer.current = null;
          }

          fadeOutTimer.current = setTimeout(() => {
            setNavigating(false);
            setProgress(0);
            pendingUrl.current = null;
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('proxy-press-navigation-reset'));
            }
          }, 300);
        }, navTimeout);
      }
    };

    // Add listener to the capture phase (third arg: true)
    document.addEventListener('click', handleCaptureClick, true);

    return () => {
      document.removeEventListener('click', handleCaptureClick, true);
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    };
  }, [navLockEnabled, navTimeout]);

  // Hover & Touch Prefetching for Instant Renders
  useEffect(() => {
    if (!hoverPrefetchEnabled) return;

    const prefetchedPaths = new Set<string>();

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

      prefetchedPaths.add(href);
      
      // Programmatically prefetch via Next.js router
      try {
        router.prefetch(href);
        console.log(`[SafeNavigation] Hover-prefetch initiated for: ${href}`);
      } catch (err) {
        console.error('[SafeNavigation] Hover-prefetch failed:', err);
      }
    };

    document.addEventListener('mouseover', handleHoverOrTouch, { passive: true });
    document.addEventListener('touchstart', handleHoverOrTouch, { passive: true });

    return () => {
      document.removeEventListener('mouseover', handleHoverOrTouch);
      document.removeEventListener('touchstart', handleHoverOrTouch);
    };
  }, [hoverPrefetchEnabled, router]);

  if (!navigating || navIndicator === 'none') return null;

  const isOled = navIndicator === 'oled';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
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
        className="safe-nav-bar" 
        style={{ 
          transform: `scaleX(${progress / 100})`,
          opacity: progress === 100 ? 0 : 1
        }}
      >
        <div className="safe-nav-glow" />
      </div>
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
