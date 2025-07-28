module.exports = {
  env: {
    API_ORIGIN: process.env.API_ORIGIN,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_ORIGIN || 'https://example.com'}/api/:path*`, // fallbackも追加
      },
    ];
  },
};
