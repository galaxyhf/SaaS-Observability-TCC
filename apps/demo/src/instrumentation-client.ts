import { initObservability } from '@tcc-observability/browser';

if (process.env.NEXT_PUBLIC_OBS_PROJECT_ID) {
  initObservability({
    projectId: process.env.NEXT_PUBLIC_OBS_PROJECT_ID,
    serviceName: 'demo-store-browser',
    environment: process.env.NEXT_PUBLIC_OBS_ENVIRONMENT ?? 'development',
    endpoint: process.env.NEXT_PUBLIC_OBS_ENDPOINT ?? 'http://localhost',
    sampleRate: 1,
  });
}
