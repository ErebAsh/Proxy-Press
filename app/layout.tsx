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
import PWAProvider from "@/lib/PWAProvider";
import SplashScreen from "@/app/components/Loading/SplashScreen";

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
              const theme = localStorage.getItem('proxy-press-theme');
              const customTheme = localStorage.getItem('proxy-press-custom-theme');
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              
              if (theme === 'dark' || (!theme && prefersDark)) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }

              if (customTheme) {
                const colors = JSON.parse(customTheme);
                Object.entries(colors).forEach(([key, value]) => {
                  document.documentElement.style.setProperty('--' + key, value);
                  if (key === 'primary') {
                    const r = parseInt(value.slice(1, 3), 16);
                    const g = parseInt(value.slice(3, 5), 16);
                    const b = parseInt(value.slice(5, 7), 16);
                    document.documentElement.style.setProperty('--primary-rgb', r + ', ' + g + ', ' + b);
                  }
                });
              }
            } catch (e) {}
          })();
        `}} />
        <style dangerouslySetInnerHTML={{ __html: `
          #initial-loader {
            position: fixed;
            inset: 0;
            background: #F8FAFC;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
          }
          .dark #initial-loader {
            background: #0F172A;
          }
        `}} />
      </head>
      <body suppressHydrationWarning>
        <PWAProvider>
          <SplashScreen />
          <NotificationsProvider>
            {children}
          </NotificationsProvider>
        </PWAProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('load', function() {
            var loader = document.getElementById('initial-loader');
            if (loader) loader.style.display = 'none';
          });
        `}} />
      </body>
    </html>
  );
}
