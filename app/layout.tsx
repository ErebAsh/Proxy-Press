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
  openGraph: {
    title: "Proxy-Press — College News",
    description: "Your premium college news platform",
    type: "website",
  },
};

import { NotificationsProvider } from "@/lib/NotificationsContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <NotificationsProvider>
          {children}
        </NotificationsProvider>
      </body>
    </html>
  );
}
