import { routeMetadata, type RouteLabel } from '@tcc-observability/route-names';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

/** Adds safe route labels in standard mode without changing existing spans. */
export function routeNamingExporter(
  delegate: SpanExporter,
  routes: RouteLabel[] = [],
): SpanExporter {
  return {
    export(spans, callback) {
      delegate.export(
        spans.map((span) => {
          const safe = sanitizeSpan(span, routes);
          const metadata = Object.fromEntries(
            Object.entries(safe.attributes).filter(([key]) =>
              [
                'http.route',
                'obs.operation.label',
                'obs.activity.type',
                'obs.request.type',
              ].includes(key),
            ),
          );
          return {
            ...span,
            spanContext: () => span.spanContext(),
            attributes: { ...span.attributes, ...metadata },
          };
        }),
        callback,
      );
    },
    shutdown: () => delegate.shutdown(),
  };
}

/** Exporta somente metadados operacionais: indicado para aplicações que manipulam segredos/SQL. */
export function strictPrivacyExporter(
  delegate: SpanExporter,
  routes: RouteLabel[] = [],
): SpanExporter {
  return {
    export(spans, callback) {
      delegate.export(
        spans.map((span) => sanitizeSpan(span, routes)),
        callback,
      );
    },
    shutdown: () => delegate.shutdown(),
  };
}

export function sanitizeSpan(
  span: ReadableSpan,
  routes: RouteLabel[] = [],
): ReadableSpan {
  const attributes: ReadableSpan['attributes'] = {};
  for (const key of ['http.method', 'http.request.method']) {
    const value = span.attributes[key];
    if (
      typeof value === 'string' &&
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(value)
    )
      attributes[key] = value;
  }
  for (const key of ['http.status_code', 'http.response.status_code']) {
    const value = span.attributes[key];
    if (typeof value === 'number' && value >= 100 && value <= 599)
      attributes[key] = value;
  }
  for (const key of ['db.system', 'db.system.name']) {
    const value = span.attributes[key];
    if (
      typeof value === 'string' &&
      ['postgresql', 'mssql', 'mysql', 'sqlite'].includes(value)
    )
      attributes[key] = value;
  }
  const resource: Record<string, string> = {};
  for (const key of [
    'service.name',
    'service.version',
    'deployment.environment.name',
    'obs.service.type',
    'obs.sdk.version',
    'telemetry.sdk.name',
    'telemetry.sdk.version',
    'telemetry.sdk.language',
  ]) {
    const value = span.resource.attributes[key];
    if (typeof value === 'string') resource[key] = value;
  }
  const isDatabase = attributes['db.system'] || attributes['db.system.name'];
  const method = String(
    attributes['http.request.method'] || attributes['http.method'] || '',
  );
  const target =
    span.attributes['http.route'] ||
    span.attributes['url.path'] ||
    span.attributes['http.target'] ||
    span.attributes['http.url'] ||
    span.attributes['url.full'];
  const route = routeMetadata(target, method, routes);
  if (!isDatabase && (span.kind === 1 || span.kind === 2))
    Object.assign(attributes, route, { 'obs.activity.type': 'request' });
  const name = isDatabase
    ? 'database.query'
    : span.kind === 1
      ? route['http.route']
        ? `${method || 'HTTP'} ${route['http.route']}`
        : 'HTTP server request'
      : span.kind === 2
        ? route['http.route']
          ? `${method || 'HTTP'} ${route['http.route']}`
          : 'HTTP client request'
        : 'server.operation';
  return {
    ...span,
    spanContext: () => ({ ...span.spanContext(), traceState: undefined }),
    resource: resourceFromAttributes(resource),
    name,
    attributes,
    status: { code: span.status.code },
    events: [],
    links: [],
  };
}
