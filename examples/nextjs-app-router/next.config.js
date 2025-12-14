/** @type {import('next').NextConfig} */
const nextConfig = {
  // API proxying for development (avoid CORS)
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/platform/:path*',
            destination: `${process.env.NEXT_PUBLIC_PLATFORM_API_URL}/:path*`,
          },
        ]
      : [];
  },
};

module.exports = nextConfig;
