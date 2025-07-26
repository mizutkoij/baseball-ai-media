/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  // API キャッシュ設定
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/:path*`,
      },
    ]
  },
  // 画像最適化設定
  images: {
    domains: ['localhost', '100.88.12.26'],
  },
  // 静的生成設定
  output: 'standalone',
}

module.exports = nextConfig