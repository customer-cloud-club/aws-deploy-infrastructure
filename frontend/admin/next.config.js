/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['@radix-ui/themes', 'recharts'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://p8uhqklb43.execute-api.ap-northeast-1.amazonaws.com/development',
  },
}

module.exports = nextConfig
