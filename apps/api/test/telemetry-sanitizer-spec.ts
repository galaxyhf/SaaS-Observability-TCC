import {
  normalizeOperationName,
  sanitizeUrl,
  TelemetrySanitizer,
} from '../src/ingestion/telemetry-sanitizer.js';

describe('TelemetrySanitizer', () => {
  const sanitizer = new TelemetrySanitizer();

  it('removes secrets and query strings while keeping useful attributes', () => {
    const result = sanitizer.attributes([
      { key: 'http.request.method', value: { stringValue: 'GET' } },
      {
        key: 'http.request.header.authorization',
        value: { stringValue: 'Bearer secret' },
      },
      { key: 'session.token', value: { stringValue: 'secret' } },
      {
        key: 'url.full',
        value: {
          stringValue: 'https://example.com/users/938271?token=secret#fragment',
        },
      },
      { key: 'db.rows_affected', value: { intValue: '12' } },
      { key: 'opaque', value: { bytesValue: Buffer.from('secret') } },
    ]);

    expect(result).toEqual({
      'db.rows_affected': 12,
      'http.request.method': 'GET',
      'url.full': 'https://example.com/users/:id',
    });
  });

  it('normalizes high-cardinality identifiers in operation paths', () => {
    expect(normalizeOperationName('GET /users/938271?tab=profile')).toBe(
      'GET /users/:id',
    );
    expect(sanitizeUrl('/orders/550e8400-e29b-41d4-a716-446655440000')).toBe(
      '/orders/:id',
    );
  });
});
