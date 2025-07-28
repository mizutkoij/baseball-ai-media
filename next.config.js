/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://100.88.12.26:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
