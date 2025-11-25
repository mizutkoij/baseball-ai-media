/** @type {import('next').NextConfig} */
// Build fix 2025-08-05 - Japanese language support
const nextConfig = {
  // Internationalization support for Japanese
  i18n: {
    locales: ['ja', 'en'],
    defaultLocale: 'ja',
  },
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
    };
    
    // Ignore warnings about critical dependencies
    config.module = config.module || {};
    config.module.exprContextCritical = false;
    config.module.unknownContextCritical = false;
    
    return config;
  },
  
  async redirects() {
    return [
      // Legacy URL compatibility
      {
        source: '/columns',
        destination: '/column',
        permanent: true,
      },
      // Phase 1: URL structure optimization - resolve keyword cannibalization
      {
        source: '/compare/players/:path*',
        destination: '/players/compare/:path*',
        permanent: true,
      },
      {
        source: '/compare/teams/:path*',
        destination: '/teams/compare/:path*',
        permanent: true,
      },
      // Phase 2: Statistics hub consolidation - eliminate scattered stats pages
      {
        source: '/database/:path*',
        destination: '/stats/database/:path*',
        permanent: true,
      },
      {
        source: '/analytics/:path*',
        destination: '/stats/analytics/:path*',
        permanent: true,
      },
      {
        source: '/sabermetrics/:path*',
        destination: '/stats/sabermetrics/:path*',
        permanent: true,
      },
      {
        source: '/seasons/:path*',
        destination: '/stats/seasons/:path*',
        permanent: true,
      },
      {
        source: '/data/:path*',
        destination: '/stats/data/:path*',
        permanent: true,
      },
      // Phase 3: URL structure optimization - intuitive entity hierarchy
      {
        source: '/teams/:year/:team/:path*',
        destination: '/teams/:team/:year/:path*',
        permanent: true,
      },
      // Phase 3: Feature consolidation - integrate scattered features
      {
        source: '/prediction/heatmap/:path*',
        destination: '/stats/analytics/:path*',
        permanent: true,
      },
    ];
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
