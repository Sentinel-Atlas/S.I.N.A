import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}/api/:path*`,
      },
    ];
  },
  webpack(config) {
    // Leaflet SSR fix
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default nextConfig;
