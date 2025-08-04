/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize build performance
  experimental: {
    // Faster builds
    turbotrace: {
      logLevel: 'error'
    }
  },
  
  // Build optimization  
  swcMinify: true,
  
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
