'use client';

import { useEffect } from 'react';
import { PushNotificationManager } from './push-notifications';
import { OfflineManager } from './offline-manager';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Offline Manager (SQLite & Network Listeners)
    OfflineManager.init();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const isCapacitor = (window as any).Capacitor !== undefined;

      if (isCapacitor) {
        // inside Capacitor native app, completely unregister SWs to prevent aggressive webview caching locks
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log('[Capacitor] Service Worker successfully unregistered and purged.');
                // Clear any HTTP caches to ensure WebView gets fresh Vercel assets
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }
            });
          }
        });
      } else {
        // Inside standard web browsers (PWA mode), register with update triggers
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
              console.log('SW registered: ', registration);
              
              // Force check for updates on startup
              registration.update();

              // Listen for update found event
              registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                  installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                      if (navigator.serviceWorker.controller) {
                        console.log('[PWA] New content is available; reloading page...');
                        window.location.reload();
                      }
                    }
                  };
                }
              };
            })
            .catch((registrationError) => {
              console.log('SW registration failed: ', registrationError);
            });
        });
      }
    }

    // Register for native push notifications
    PushNotificationManager.register();
  }, []);

  return <>{children}</>;
}
