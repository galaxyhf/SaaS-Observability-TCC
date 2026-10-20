import { createRequire } from 'node:module';

// Mantenha o SDK fora do bundle para preservar os hooks nativos dos drivers.
const { initObservability } = createRequire(import.meta.url)(
  '@tcc-observability/node',
) as typeof import('@tcc-observability/node');

const projectKey = process.env.OBS_PROJECT_KEY;

if (projectKey) {
  initObservability({
    endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    environment: process.env.OBS_ENVIRONMENT ?? 'development',
    projectKey,
    serviceName: process.env.OBS_SERVICE_NAME ?? 'demo-store-server',
    serviceVersion: '0.1.0',
  });
} else if (process.env.NODE_ENV !== 'test') {
  console.warn(
    '[demo] OBS_PROJECT_KEY ausente; a aplicação funcionará sem exportar traces.',
  );
}
