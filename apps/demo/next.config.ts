import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack(config, { isServer }) {
    if (isServer) {
      // O hook instrumentation também precisa preservar o pacote nativo:
      // serverExternalPackages sozinho não cobre essa camada do webpack.
      config.externals.unshift(
        (
          { request }: { request?: string },
          callback: (error: Error | null, result?: string) => void,
        ) => {
          if (request === '@tcc-observability/node')
            callback(null, 'commonjs @tcc-observability/node');
          else callback(null);
        },
      );
    }
    return config;
  },
  poweredByHeader: false,
  serverExternalPackages: [
    '@opentelemetry/auto-instrumentations-node',
    '@tcc-observability/node',
    'pg',
  ],
};

export default nextConfig;
