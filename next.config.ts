import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "172.16.18.209",
    "172.16.*",
    "192.168.*",
    "10.*",
    "localhost:3000",
    "127.0.0.1:3000"
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  async redirects() {
    return [
      {
        source: "/dashboard/settings/showroom",
        destination: "/settings/showroom",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
