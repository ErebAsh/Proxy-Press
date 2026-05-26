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

          // 1. Hide custom Android splash if available
          if ((window as any).AndroidNativeSplash) {
            console.log('[Splash] Found AndroidNativeSplash, hiding...');
            (window as any).AndroidNativeSplash.hide();
            success = true;
          }
          if ((window as any).NativeSplash) {
            (window as any).NativeSplash.hide();
            success = true;
          }

          // 2. Hide Capacitor built-in splash screen
          try {
            const { SplashScreen } = await import('@capacitor/splash-screen');
            await SplashScreen.hide();
            success = true;
          } catch (e) {}

          if (success || attempts >= maxAttempts) {
            clearInterval(interval);
          }
        } catch (e) {
          if (attempts >= maxAttempts) clearInterval(interval);
        }
      }, 200);
    };
    
    hideNative();
    
    // Push Notifications Initialization
    const initPushNotifications = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        
        if (permStatus.receive !== 'granted') {
          console.log('[Push] Permission not granted');
          return;
        }
        
        await PushNotifications.register();
        
        PushNotifications.addListener('registration', (token) => {
          console.log('[Push] Token:', token.value);
          // Save to local storage so other components can read it and save to DB
          localStorage.setItem('fcm_token', token.value);
        });
        
        PushNotifications.addListener('registrationError', (error) => {
          console.error('[Push] Error:', error);
        });
        
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[Push] Received:', notification);
        });
        
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('[Push] Action performed:', notification);
        });
        
      } catch (e) {
        console.log('[Push] Plugin not available or failed to init');
      }
    };
    
    initPushNotifications();
    
    // Request Camera, Photo Library, and Microphone permissions on startup
    const initAppPermissions = async () => {
      // Only request permissions on the first launch after installation
      const prompted = localStorage.getItem('startup_permissions_requested');
      if (prompted) return;

      try {
        console.log('[Permissions] Requesting startup permissions...');

        // 1. Camera & Photos permission via Capacitor
        try {
          const { Camera } = await import('@capacitor/camera');
          await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        } catch (e) {
          console.log('[Permissions] Capacitor Camera permissions not available:', e);
        }

        // 2. Force system-level Microphone and Camera permissions prompt via WebRTC
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            // Immediately stop tracks to free up the hardware
            stream.getTracks().forEach(track => track.stop());
            console.log('[Permissions] WebRTC media permissions granted on startup');
          } catch (e) {
            console.warn('[Permissions] WebRTC startup permission prompt failed/denied:', e);
          }
        }

        localStorage.setItem('startup_permissions_requested', 'true');
      } catch (err) {
        console.error('[Permissions] Permission initialization error:', err);
      }
    };
    initAppPermissions();

    // 2.5. Listen for native back button / swipe back gesture on Android/iOS
    const initBackButton = async () => {
      try {
        const { App } = await import('@capacitor/app');
        await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
          } else {
            App.minimizeApp();
          }
        });
        console.log('[Capacitor] Back button/swipe gesture listener registered');
      } catch (e) {
        console.log('[Capacitor] App plugin backButton event not supported on this platform');
      }
    };

    initBackButton();
    
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
