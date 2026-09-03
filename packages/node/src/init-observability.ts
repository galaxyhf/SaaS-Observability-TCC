import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';

import {
  validateConfig,
  type ObservabilityConfig,
  type ValidatedObservabilityConfig,
} from './config.js';

export interface ObservabilityController {
  shutdown(): Promise<void>;
}

interface ActiveSdk {
  config: ValidatedObservabilityConfig;
  controller: ObservabilityController;
}

let activeSdk: ActiveSdk | undefined;

function sameConfiguration(
  left: ValidatedObservabilityConfig,
  right: ValidatedObservabilityConfig,
): boolean {
  return (
    left.endpoint === right.endpoint &&
    left.environment === right.environment &&
    left.projectKey === right.projectKey &&
    left.serviceName === right.serviceName &&
    left.serviceVersion === right.serviceVersion
  );
}

export function initObservability(
  input: ObservabilityConfig,
): ObservabilityController {
  const config = validateConfig(input);

  if (activeSdk) {
    if (!sameConfiguration(activeSdk.config, config)) {
      throw new Error(
        'Observability is already initialized with a different configuration.',
      );
    }
    return activeSdk.controller;
  }

  const resource = resourceFromAttributes({
    'deployment.environment.name': config.environment,
    'obs.service.type': 'server',
    ...(config.serviceVersion
      ? { 'service.version': config.serviceVersion }
      : {}),
  });
  const exporter = new OTLPTraceExporter({
    concurrencyLimit: 5,
    headers: { 'x-obs-project-key': config.projectKey },
    url: config.endpoint,
  });
  const sdk = new NodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-pg': {
          enhancedDatabaseReporting: false,
        },
        '@opentelemetry/instrumentation-undici': {
          headersToSpanAttributes: {
            requestHeaders: [],
            responseHeaders: [],
          },
        },
      }),
    ],
    resource,
    serviceName: config.serviceName,
    traceExporter: exporter,
  });

  sdk.start();
  let shutdownPromise: Promise<void> | undefined;
  const controller: ObservabilityController = {
    shutdown: () => {
      shutdownPromise ??= sdk.shutdown();
      return shutdownPromise;
    },
  };
  activeSdk = { config, controller };
  process.once('beforeExit', () => {
    void controller.shutdown();
  });
  return controller;
}
