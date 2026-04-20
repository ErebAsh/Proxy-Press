import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ["192.168.56.1", "*.trycloudflare.com"],
  serverActions: {
    bodySizeLimit: '10mb',
  },
};

export default nextConfig;
