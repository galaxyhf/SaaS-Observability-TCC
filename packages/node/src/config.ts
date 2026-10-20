import {
  validateRoutes,
  type RouteLabel,
} from '@tcc-observability/route-names';
export interface ObservabilityConfig {
  routes?: RouteLabel[];
  /** strict remove SQL, URLs, mensagens, eventos e atributos fora de uma allowlist. */
  privacyMode?: 'standard' | 'strict';
  /** Environment name, for example production, staging or development. */
  environment: string;
  /** OTLP/HTTP endpoint. A bare Collector URL receives /v1/traces automatically. */
  endpoint?: string;
  /** Private server-side Project Key. Never expose it in browser bundles. */
  projectKey: string;
  /** OpenTelemetry service.name. */
  serviceName: string;
  /** Optional deployed application version. */
  serviceVersion?: string;
}

export interface ValidatedObservabilityConfig {
  routes?: RouteLabel[];
  privacyMode: 'standard' | 'strict';
  endpoint: string;
  environment: string;
  projectKey: string;
  serviceName: string;
  serviceVersion?: string;
}

function required(value: string, name: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  if (normalized.length > maximum) {
    throw new Error(`${name} must have at most ${maximum} characters.`);
  }
  return normalized;
}

export function normalizeTraceEndpoint(value: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error('endpoint must be a valid HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('endpoint must use HTTP or HTTPS.');
  }
  if (endpoint.username || endpoint.password) {
    throw new Error('endpoint must not contain embedded credentials.');
  }
  endpoint.search = '';
  endpoint.hash = '';
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '');
  if (!endpoint.pathname.endsWith('/v1/traces')) {
    endpoint.pathname = `${endpoint.pathname}/v1/traces`.replace(
      /\/{2,}/g,
      '/',
    );
  }
  return endpoint.toString();
}

export function validateConfig(
  config: ObservabilityConfig,
): ValidatedObservabilityConfig {
  if (
    config.privacyMode !== undefined &&
    !['standard', 'strict'].includes(config.privacyMode)
  ) {
    throw new Error('privacyMode must be standard or strict.');
  }
  validateRoutes(config.routes);
  const projectKey = required(config.projectKey, 'projectKey', 128);
  if (!projectKey.startsWith('obs_live_')) {
    throw new Error(
      'projectKey must be a private key with the obs_live_ prefix.',
    );
  }

  const serviceVersion = config.serviceVersion?.trim();
  return {
    ...(config.routes ? { routes: config.routes } : {}),
    privacyMode: config.privacyMode ?? 'standard',
    endpoint: normalizeTraceEndpoint(
      config.endpoint ??
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
        'http://localhost:4318',
    ),
    environment: required(config.environment, 'environment', 80),
    projectKey,
    serviceName: required(config.serviceName, 'serviceName', 255),
    ...(serviceVersion
      ? { serviceVersion: required(serviceVersion, 'serviceVersion', 80) }
      : {}),
  };
}
