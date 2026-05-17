'use client';

import { useState, useEffect } from 'react';
import { SplashScreen as NativeSplash } from '@capacitor/splash-screen';
import './SplashScreen.css';

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('splash_shown');
    }
    return true;
  });

  useEffect(() => {
    // Hide native splash screen as soon as web splash is ready
    const hideNative = async () => {
      let attempts = 0;
      const maxAttempts = 20; // Try for 4 seconds (20 * 200ms)

      const interval = setInterval(async () => {
        try {
          attempts++;
          let success = false;

          // First try the custom Java interface for Pure Native experience
          if ((window as any).AndroidNativeSplash) {
            console.log('[Splash] Found AndroidNativeSplash, hiding...');
            (window as any).AndroidNativeSplash.hide();
            success = true;
          } else if ((window as any).NativeSplash) {
            // Check for old name just in case
            (window as any).NativeSplash.hide();
            success = true;
          } else {
            // Fallback for standard Capacitor splash plugin
            console.log('[Splash] Using standard Capacitor splash fallback');
            await NativeSplash.hide();
            success = true;
          }

          if (success || attempts >= maxAttempts) {
            clearInterval(interval);
          }
        } catch (e) {
          if (attempts >= maxAttempts) clearInterval(interval);
        }
      }, 200);
    };
    
    // After 2 seconds, fade out the web splash
    if (isVisible) {
      hideNative();
      localStorage.setItem('splash_shown', 'true');
      
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className={`splash-screen ${!isVisible ? 'fade-out' : ''}`}>
      <div className="news-line"></div>
      <div className="news-line"></div>
      <div className="news-line"></div>
      <div className="news-line"></div>
      
      <div className="splash-bg-ripples">
        <div className="ripple"></div>
        <div className="ripple"></div>
        <div className="ripple"></div>
        <div className="ripple"></div>
      </div>

      <div className="splash-container">
        <div className="splash-logo-reveal">
          <span className="splash-logo-text">Proxy-Press</span>
        </div>
        <div className="splash-loader-bar">
          <div className="splash-loader-progress"></div>
        </div>
      </div>
    </div>
  );
}
