"use client";

import { useEffect } from 'react';

export default function CapacitorInitializer() {
  useEffect(() => {
    const initStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        
        // 1. Make the status bar overlay the webview (transparent background)
        // This makes it automatically follow the color of your header!
        await StatusBar.setOverlaysWebView({ overlay: true });
        
        // 2. Set the initial icon style based on the current theme
        const isDark = document.documentElement.classList.contains('dark');
        await StatusBar.setStyle({ 
          style: isDark ? Style.Dark : Style.Light 
        });
        
        console.log('[Capacitor] Status bar initialized with theme');
      } catch (e) {
        console.log('[Capacitor] Status bar plugin not available');
      }
    };
    
    initStatusBar();
    
    // Hide native splash screen as soon as app is ready
    const hideNative = async () => {
      let attempts = 0;
      const maxAttempts = 20;

      const interval = setInterval(async () => {
        try {
          attempts++;
          let success = false;

          if ((window as any).AndroidNativeSplash) {
            console.log('[Splash] Found AndroidNativeSplash, hiding...');
            (window as any).AndroidNativeSplash.hide();
            success = true;
          } else if ((window as any).NativeSplash) {
            (window as any).NativeSplash.hide();
            success = true;
          } else {
            try {
              const { SplashScreen } = await import('@capacitor/splash-screen');
              await SplashScreen.hide();
              success = true;
            } catch (e) {}
          }

          if (success || attempts >= maxAttempts) {
            clearInterval(interval);
          }
        } catch (e) {
          if (attempts >= maxAttempts) clearInterval(interval);
        }
      }, 200);
    };
    
    hideNative();
    
    // 3. Listen for theme changes dynamically
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      }).catch(() => {});
    });
    
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);

  return null;
}
