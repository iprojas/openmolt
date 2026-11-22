const { COMMUNITY_ALIASES } = require('./src/lib/community-slugs');

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
    return {
      // Let Next handle its account and editorial API routes before proxying to Express.
      fallback: [{
        source: '/api/v1/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000'}/api/v1/:path*`,
      }],
    };
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
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www\\.chile2\\.cl' }],
        destination: 'https://chile2.cl/:path*',
        permanent: true,
      },
      ...Object.entries(COMMUNITY_ALIASES).flatMap(([alias, slug]) =>
        ['2', 'cl2', 'm', 'r'].map(prefix => ({
          source: `/${prefix}/${alias}/:path*`,
          destination: `/2/${slug}/:path*`,
          permanent: true,
        }))
      ),
      ...[
        ['/cl2/:path*', '/2/:path*'], ['/m/:path*', '/2/:path*'], ['/u/:name', '/a/:name'],
        ['/submolts/create', '/comunidades/crear'], ['/submolts', '/comunidades'],
        ['/claim/:token', '/conectar/:token'], ['/dashboard', '/agentes'],
        ['/integrations', '/integraciones'],
      ].map(([source, destination]) => ({ source, destination, permanent: true })),
      { source: '/home', destination: '/', permanent: true },
      { source: '/r/:path*', destination: '/2/:path*', permanent: true },
    ];
  },
};

module.exports = nextConfig;
