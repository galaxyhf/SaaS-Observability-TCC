import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { strictPrivacyExporter } from '../src/privacy-exporter.js';
import { SpanStatusCode } from '@opentelemetry/api';

describe('privacidade estrita no SDK Node', () => {
  it('preserva rota e rótulo seguros sem exportar valores dinâmicos', async () => {
    const captured = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [
        new SimpleSpanProcessor(
          strictPrivacyExporter(captured, [
            {
              path: '/api/invoices/:id',
              method: 'POST',
              label: 'Enviar fatura',
            },
          ]),
        ),
      ],
    });
    const span = provider
      .getTracer('routes')
      .startSpan('POST /api/invoices/private-token', { kind: 1 });
    span.setAttributes({
      'http.method': 'POST',
      'http.url':
        'https://user:pw@host/api/invoices/private-token?secret=private-token',
      'http.status_code': 400,
    });
    span.end();
    await provider.forceFlush();
    const result = captured.getFinishedSpans()[0]!;
    expect(result.name).toBe('POST /api/invoices/:id');
    expect(result.attributes['obs.operation.label']).toBe('Enviar fatura');
    expect(JSON.stringify(result.attributes)).not.toContain('private-token');
    expect(result.attributes['http.status_code']).toBe(400);
    await provider.shutdown();
  });
  it('remove SQL, segredos e mensagens antes da exportação e preserva os IDs', async () => {
    const captured = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      resource: resourceFromAttributes({
        'service.name': 'sqlvault-server',
        'process.command_args': ['password-private'],
        'db.connection_string': 'postgres://secret',
      }),
      spanProcessors: [
        new SimpleSpanProcessor(strictPrivacyExporter(captured)),
      ],
    });
    const span = provider
      .getTracer('privacy-test')
      .startSpan('SELECT private_secret FROM users', { kind: 2 });
    const id = span.spanContext().traceId;
    span.setAttributes({
      'db.system': 'postgresql',
      'db.statement': 'SELECT private_secret FROM users',
      'db.name': 'private',
      'http.url': 'https://user:private@host/path?token=private',
      authorization: 'Bearer private',
    });
    span.recordException(new Error('private password'));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'private SQL error',
    });
    span.end();
    await provider.forceFlush();
    const result = captured.getFinishedSpans()[0]!;
    expect(result.spanContext().traceId).toBe(id);
    expect(result.name).toBe('database.query');
    expect(result.attributes).toEqual({ 'db.system': 'postgresql' });
    expect(result.events).toEqual([]);
    expect(result.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(result.resource.attributes).toEqual({
      'service.name': 'sqlvault-server',
    });
    await provider.shutdown();
  });
});
