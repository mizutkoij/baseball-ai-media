/** @type {import('next').NextConfig} */
// Build fix 2025-08-05
const nextConfig = {
  // Enable standalone output for containerization (disabled for initial build test)
  // output: 'standalone',
  
  // Optimize build performance
  experimental: {
    // Faster builds
    turbotrace: {
      logLevel: 'error'
    }
  },
  
  // Build optimization  
  swcMinify: true,
  
  // Webpack configuration to prevent build-time issues
  webpack: (config, { isServer, buildId, dev }) => {
    // Exclude problematic server-only modules from client bundle
    if (!isServer && !dev) {
      config.externals = config.externals || [];
      config.externals.push({
        'better-sqlite3': 'better-sqlite3',
        'fs/promises': 'fs/promises',
        'fs': 'fs',
        'path': 'path'
      });
    }
    
    // Add resolve fallbacks for client-side
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      'better-sqlite3': false,
    };
    
    // Ignore warnings about critical dependencies
    config.module = config.module || {};
    config.module.exprContextCritical = false;
    config.module.unknownContextCritical = false;
    
    return config;
  },
  
  async rewrites() {
    // Only apply rewrites if API base URL is configured
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl || apiBaseUrl.includes('localhost')) {
      console.log('Skipping API rewrites - no external API configured');
      return [];
    }
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
  
  // Additional Next.js configurations can be added here as needed
};

module.exports = nextConfig;
