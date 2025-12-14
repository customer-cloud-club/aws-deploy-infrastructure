/** @type {import('next').NextConfig} */
const nextConfig = {
  // API proxying for development (avoid CORS)
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (process.env.NODE_ENV === 'development' && apiUrl) {
      return [
        {
          source: '/api/platform/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
