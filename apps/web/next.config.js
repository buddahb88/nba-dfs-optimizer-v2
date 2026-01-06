/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nba-dfs/types', '@nba-dfs/utils'],
  // Note: 'standalone' output disabled for Windows compatibility
  // Enable for Docker deployments: output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
