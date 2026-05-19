'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function SafeNavigationGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Track timestamps and URLs to enforce navigation lock
  const lastNavTime = useRef<number>(0);
  const pendingUrl = useRef<string | null>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const fadeOutTimer = useRef<NodeJS.Timeout | null>(null);

  // Complete navigation when pathname or searchParams change
  useEffect(() => {
    if (pendingUrl.current) {
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

      // Rule 2: Prevent navigating to a different page while one is already pending
      if (pendingUrl.current && pendingUrl.current !== href) {
        console.log(`[SafeNavigation] Blocked navigation to "${href}" because transition to "${pendingUrl.current}" is in progress.`);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Allow navigation: Update lock states
      lastNavTime.current = now;
      pendingUrl.current = href;
      
      // Trigger progress bar animations
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
      if (progressTimer.current) clearInterval(progressTimer.current);
      
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
    };

    // Add listener to the capture phase (third arg: true)
    document.addEventListener('click', handleCaptureClick, true);

    return () => {
      document.removeEventListener('click', handleCaptureClick, true);
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
    };
  }, []);

  if (!navigating) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .safe-nav-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #2563EB 0%, #8B5CF6 50%, #EF4444 100%);
          box-shadow: 0 1px 10px rgba(139, 92, 246, 0.5);
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
          background: linear-gradient(90deg, transparent, #FFFFFF);
          box-shadow: 0 0 10px #FFFFFF, 0 0 5px #8B5CF6;
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
