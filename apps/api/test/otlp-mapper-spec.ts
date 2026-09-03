import { OtlpMapper } from '../src/ingestion/otlp-mapper.js';
import type { ExportTraceServiceRequest } from '../src/ingestion/otlp.types.js';
import { TelemetrySanitizer } from '../src/ingestion/telemetry-sanitizer.js';

function validRequest(): ExportTraceServiceRequest {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'checkout-server' } },
            {
              key: 'deployment.environment.name',
              value: { stringValue: 'Production' },
            },
            { key: 'telemetry.sdk.language', value: { stringValue: 'nodejs' } },
            { key: 'authorization', value: { stringValue: 'never-store-me' } },
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: '@opentelemetry/instrumentation-http',
              version: '1.0.0',
            },
            spans: [
              {
                attributes: [
                  {
                    key: 'http.response.status_code',
                    value: { intValue: '200' },
                  },
                  {
                    key: 'url.full',
                    value: {
                      stringValue: 'https://app.test/orders/12345?secret=x',
                    },
                  },
                ],
                endTimeUnixNano: '1700000000123456000',
                flags: 1,
                kind: 2,
                name: 'GET /orders/12345?secret=x',
                spanId: Buffer.from('0011223344556677', 'hex'),
                startTimeUnixNano: '1700000000000000000',
                status: { code: 1 },
                traceId: Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('OtlpMapper', () => {
  const mapper = new OtlpMapper(new TelemetrySanitizer());

  it('maps a standard OTLP span without losing trace identity or precision', () => {
    const result = mapper.map(validRequest());

    expect(result.rejectedSpans).toBe(0);
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]).toMatchObject({
      durationMs: '123.456',
      environmentSlug: 'production',
      kind: 'SERVER',
      name: 'GET /orders/:id',
      serviceName: 'checkout-server',
      serviceType: 'SERVER',
      spanId: '0011223344556677',
      statusCode: 'OK',
      traceId: '00112233445566778899aabbccddeeff',
    });
    expect(result.spans[0]?.resourceAttributes).not.toHaveProperty(
      'authorization',
    );
    expect(result.spans[0]?.attributes['url.full']).toBe(
      'https://app.test/orders/:id',
    );
  });

  it('partially rejects malformed spans instead of accepting invalid IDs', () => {
    const request = validRequest();
    const span = request.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0];
    if (span) span.traceId = Buffer.alloc(16);

    const result = mapper.map(request);
    expect(result.spans).toHaveLength(0);
    expect(result.rejectedSpans).toBe(1);
    expect(result.warnings[0]).toContain('trace_id');
  });
});
