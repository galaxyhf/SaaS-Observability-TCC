import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: [
    '@opentelemetry/auto-instrumentations-node',
    '@tcc-observability/node',
    'pg',
  ],
};

export default nextConfig;
