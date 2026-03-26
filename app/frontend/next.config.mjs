/** @type {import('next').NextConfig} */

const isStaticExport = process.env.NEXT_BUILD_MODE === 'static';

const nextConfig = {
  // Static export for production serving by the backend.
  // Rewrites are incompatible with output:'export', so they are
  // only enabled in dev / standard build mode.
  ...(isStaticExport
    ? { output: 'export' }
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}/api/:path*`,
            },
          ];
        },
      }),
  webpack(config) {
    // Leaflet SSR fix — fs is not available in the browser bundle
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default nextConfig;
