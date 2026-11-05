import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: `${process.env.INTERNAL_API_URL ?? 'http://localhost:4000'}/api/v1/media/:path*`,
      },
    ];
  },
  logging: { incomingRequests: false },
  experimental: { cpus: 2 },
};
export default withNextIntl(config);
