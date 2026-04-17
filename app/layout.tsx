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
      <body>
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
