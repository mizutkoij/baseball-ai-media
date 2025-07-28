module.exports = {
  async rewrites() {
    const destination = process.env.API_ORIGIN
      ? `${process.env.API_ORIGIN}/api/:path*`
      : "https://example.com/api/:path*"; // fallback to avoid build error

    return [
      {
        source: '/api/:path*',
        destination,
      },
    ];
  },
};
