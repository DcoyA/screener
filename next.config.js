/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.hellomedia.win',
          },
        ],
        destination: 'https://hellomedia.win/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
