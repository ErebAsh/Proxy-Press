import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Proxy-Press — College News",
  description:
    "Stay updated with the latest news, events, and announcements from your college campus. Proxy-Press is the premium college news platform.",
  keywords: ["college news", "campus updates", "events", "notices", "student news"],
  authors: [{ name: "Proxy-Press" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Proxy-Press",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Proxy-Press — College News",
    description: "Your premium college news platform",
    type: "website",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

import { NotificationsProvider } from "@/lib/NotificationsContext";
import { IdentityProvider } from "@/lib/IdentityContext";
import PWAProvider from "@/lib/PWAProvider";
import GlobalRealtimeListener from "@/app/components/GlobalRealtimeListener";
import GlobalCallManager from "@/app/components/GlobalCallManager";
import CapacitorInitializer from "@/app/components/CapacitorInitializer";
import SafeNavigationGuard from "@/app/components/SafeNavigationGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#2563EB" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              document.documentElement.classList.add('theme-loading');
              const theme = localStorage.getItem('proxy-press-theme');
              const customTheme = localStorage.getItem('proxy-press-custom-theme');
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              const isDark = theme === 'dark' || (!theme && prefersDark);
              
              if (isDark) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }

              // Default backgrounds
              let bgColor = isDark ? '#0F172A' : '#F8FAFC';

              // Override with custom theme if present
              if (customTheme) {
                try {
                  const colors = JSON.parse(customTheme);
                  if (colors.bg) bgColor = colors.bg;
                  
                  Object.entries(colors).forEach(([key, value]) => {
                    document.documentElement.style.setProperty('--' + key, value);
                    if (key === 'primary') {
                      const r = parseInt(value.slice(1, 3), 16);
                      const g = parseInt(value.slice(3, 5), 16);
                      const b = parseInt(value.slice(5, 7), 16);
                      document.documentElement.style.setProperty('--primary-rgb', r + ', ' + g + ', ' + b);
                    }
                  });
                } catch (e) {}
              }
              
              // Apply the chosen background color to the root immediately
              document.documentElement.style.backgroundColor = bgColor;
              
              // Create a style element to lock the background color
              const style = document.createElement('style');
              style.id = 'theme-lock-style';
              style.innerHTML = 'html, body { background-color: ' + bgColor + ' !important; }';
              document.head.appendChild(style);

              // Cleanup loading class
              setTimeout(function() {
                document.documentElement.classList.remove('theme-loading');
              }, 500);
            } catch (e) {}
          })();
        `}} />
        <style dangerouslySetInnerHTML={{ __html: `
          :root { color-scheme: light; }
          :root.dark { color-scheme: dark; }
          html, body { 
            margin: 0; 
            padding: 0; 
          }
        `}} />
      </head>
      <body suppressHydrationWarning>
        <CapacitorInitializer />
        <PWAProvider>
          <IdentityProvider>
            <NotificationsProvider>
              <GlobalRealtimeListener />
              <GlobalCallManager />
              <SafeNavigationGuard />
              {children}
            </NotificationsProvider>
          </IdentityProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
