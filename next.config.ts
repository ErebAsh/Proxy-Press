import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ["192.168.56.1", "*.trycloudflare.com"],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  headers: async () => [
    {
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    {
      source: '/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' },
      ],
    },
  ],
};

export default nextConfig;
