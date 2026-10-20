import {
  routeMetadata,
  validateRoutes,
  type RouteLabel,
} from '@tcc-observability/route-names';
import {
  context,
  propagation,
  trace,
  SpanStatusCode,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

export interface BrowserObservabilityOptions {
  projectId: string;
  serviceName: string;
  environment: string;
  /** Base pública da plataforma, como https://observa.example.com. */
  endpoint: string;
  /** Origens exatas autorizadas a receber traceparent. Mesma origem é automática. */
  propagateToOrigins?: string[];
  sampleRate?: number;
  /** Templates públicos e rótulos estáticos opcionais; nunca valores de usuários. */
  routes?: RouteLabel[];
}

export function validateOptions(options: BrowserObservabilityOptions): void {
  validateRoutes(options.routes);
  if (!/^obs_pub_[a-zA-Z0-9_-]{1,72}$/.test(options.projectId))
    throw new Error('Use o identificador público obs_pub_.');
  for (const value of [options.serviceName, options.environment]) {
    if (!value?.trim() || value.length > 80)
      throw new Error(
        'Serviço e ambiente são obrigatórios (até 80 caracteres).',
      );
  }
  const endpoint = new URL(options.endpoint);
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  )
    throw new Error('Endpoint deve ser a origem HTTP(S) da plataforma.');
  const rate = options.sampleRate ?? 1;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new Error('sampleRate deve estar entre 0 e 1.');
  for (const origin of options.propagateToOrigins ?? []) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
      throw new Error('Informe origens exatas para propagação.');
  }
}

/** Allowlist: nenhum header, body, mensagem de exceção, query ou fragmento sai do browser. */
export function safeAttributes(
  attributes: ReadableSpan['attributes'],
): ReadableSpan['attributes'] {
  const safe: ReadableSpan['attributes'] = {};
  for (const key of [
    'http.method',
    'http.request.method',
    'http.status_code',
    'http.response.status_code',
  ]) {
    const value = attributes[key];
    if (
      typeof value === 'number' ||
      (typeof value === 'string' && /^[A-Z]{1,16}$/.test(value))
    )
      safe[key] = value;
  }
  for (const key of ['http.url', 'url.full']) {
    const value = attributes[key];
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value);
      // Caminhos também podem carregar tokens e dados pessoais: só a origem é exportada.
      safe[key] = url.origin;
    } catch {
      /* Atributos inválidos são descartados. */
    }
  }
  return safe;
}

function privateExporter(
  delegate: SpanExporter,
  routes: RouteLabel[] = [],
): SpanExporter {
  return {
    export(spans, callback) {
      delegate.export(
        spans.map((span) => ({
          ...span,
          spanContext: () => span.spanContext(),
          name:
            span.kind === 2
              ? `${span.attributes['http.method'] || span.attributes['http.request.method'] || 'HTTP'} ${routeMetadata(span.attributes['http.url'] || span.attributes['url.full'], String(span.attributes['http.method'] || span.attributes['http.request.method'] || ''), routes)['http.route'] || '/request'}`
              : [
                    'document.load',
                    'navigation',
                    'browser.error',
                    'browser.unhandledrejection',
                  ].includes(span.name)
                ? span.name
                : 'browser.operation',
          attributes: {
            ...safeAttributes(span.attributes),
            ...routeMetadata(
              span.attributes['http.url'] ||
                span.attributes['url.full'] ||
                span.attributes['obs.page.url'],
              String(
                span.attributes['http.method'] ||
                  span.attributes['http.request.method'] ||
                  '',
              ),
              routes,
            ),
            'obs.activity.type':
              span.kind === 2
                ? 'request'
                : span.name === 'document.load' || span.name === 'navigation'
                  ? 'navigation'
                  : span.name.startsWith('browser.') && span.status.code === 2
                    ? 'error'
                    : 'operation',
          },
          status: { code: span.status.code },
          events: [],
          links: [],
        })),
        callback,
      );
    },
    shutdown: () => delegate.shutdown(),
  };
}

let active: BrowserObservability | undefined;
let activeConfiguration: string | undefined;
export interface BrowserObservability {
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export function initObservability(
  options: BrowserObservabilityOptions,
): BrowserObservability {
  validateOptions(options);
  if (typeof window === 'undefined')
    throw new Error('O SDK browser só pode iniciar no navegador.');
  const signature = JSON.stringify([
    options.projectId,
    options.endpoint,
    options.serviceName,
    options.environment,
    options.sampleRate ?? 1,
    options.routes ?? [],
    [...(options.propagateToOrigins ?? [])].sort(),
  ]);
  if (active) {
    if (signature !== activeConfiguration)
      throw new Error('SDK browser já inicializado com outra configuração.');
    return active;
  }
  activeConfiguration = signature;
  const url = `${new URL(options.endpoint).origin}/api/browser/${options.projectId}/v1/traces`;
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      'service.name': options.serviceName.trim(),
      'deployment.environment.name': options.environment.trim(),
      'obs.service.type': 'browser',
      'obs.sdk.version': '0.1.0',
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(options.sampleRate ?? 1),
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        privateExporter(
          new OTLPTraceExporter({ url, timeoutMillis: 10_000 }),
          options.routes,
        ),
        {
          maxExportBatchSize: 100,
          maxQueueSize: 500,
          scheduledDelayMillis: 2000,
        },
      ),
    ],
  });
  provider.register({ propagator: new W3CTraceContextPropagator() });
  const propagateTraceHeaderCorsUrls = (options.propagateToOrigins ?? []).map(
    (origin) =>
      new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`),
  );
  const config = {
    propagateTraceHeaderCorsUrls,
    ignoreUrls: [
      new RegExp(`^${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[?#]|$)`),
    ],
  };
  const unregister = registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new FetchInstrumentation(config),
      new XMLHttpRequestInstrumentation(config),
    ],
  });
  const tracer = trace.getTracer('@tcc-observability/browser', '0.1.0');
  const record = (name: string, error = false) => {
    const span = tracer.startSpan(name, {
      attributes: { 'obs.page.url': window.location.href },
    });
    if (error) span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
  };
  const load = () => {
    const timing = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    if (timing && timing.loadEventEnd > 0) {
      const span = tracer.startSpan('document.load', {
        attributes: { 'obs.page.url': window.location.href },
        startTime: new Date(performance.timeOrigin + timing.startTime),
      });
      span.end(new Date(performance.timeOrigin + timing.loadEventEnd));
    } else record('document.load');
  };
  let lastPathname = window.location.pathname;
  const navigation = () => {
    if (window.location.pathname === lastPathname) return;
    lastPathname = window.location.pathname;
    record('navigation');
  };
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;
  const wrapHistory = (original: History['pushState']): History['pushState'] =>
    function (this: History, ...args: Parameters<History['pushState']>) {
      original.apply(this, args);
      navigation();
    };
  const pushState = wrapHistory(originalPushState);
  const replaceState = wrapHistory(originalReplaceState);
  window.history.pushState = pushState;
  window.history.replaceState = replaceState;
  const error = () => record('browser.error', true);
  const rejection = () => record('browser.unhandledrejection', true);
  const flush = () => {
    void provider.forceFlush().catch(() => undefined);
  };
  const visibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleLoad = () => {
    loadTimer = setTimeout(load, 0);
  };
  if (document.readyState === 'complete') scheduleLoad();
  else window.addEventListener('load', scheduleLoad, { once: true });
  window.addEventListener('popstate', navigation);
  window.addEventListener('hashchange', navigation);
  window.addEventListener('error', error);
  window.addEventListener('unhandledrejection', rejection);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', visibility);
  active = {
    flush: () => provider.forceFlush(),
    async shutdown() {
      unregister();
      if (window.history.pushState === pushState)
        window.history.pushState = originalPushState;
      if (window.history.replaceState === replaceState)
        window.history.replaceState = originalReplaceState;
      clearTimeout(loadTimer);
      window.removeEventListener('load', scheduleLoad);
      window.removeEventListener('popstate', navigation);
      window.removeEventListener('hashchange', navigation);
      window.removeEventListener('error', error);
      window.removeEventListener('unhandledrejection', rejection);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
      await provider.shutdown();
      trace.disable();
      context.disable();
      propagation.disable();
      active = undefined;
      activeConfiguration = undefined;
    },
  };
  return active;
}
