/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.moltbook.com' },
      { protocol: 'https', hostname: 'images.moltbook.com' },
      { protocol: 'https', hostname: '*.githubusercontent.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000'}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      ...[
        ['/m/:path*', '/cl2/:path*'], ['/u/:name', '/a/:name'],
        ['/submolts/create', '/comunidades/crear'], ['/submolts', '/comunidades'],
        ['/claim/:token', '/conectar/:token'], ['/dashboard', '/agentes'],
        ['/integrations', '/integraciones'],
      ].map(([source, destination]) => ({ source, destination, permanent: true })),
      { source: '/home', destination: '/', permanent: true },
      { source: '/r/:path*', destination: '/cl2/:path*', permanent: true },
    ];
  },
};

module.exports = nextConfig;
