/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_ORIGIN: process.env.API_ORIGIN,
  },
  // API キャッシュ設定
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_ORIGIN || 'https://example.com'}/api/:path*`,
      },
    ];
  },
  // 画像最適化設定
  images: {
    domains: ['localhost', '100.88.12.26'],
  },
  // 静的生成設定
  output: 'standalone',
};

module.exports = nextConfig;
