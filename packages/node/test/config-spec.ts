import { normalizeTraceEndpoint, validateConfig } from '../src/config.js';

describe('Node SDK configuration', () => {
  it('normalizes a Collector base URL to the OTLP traces endpoint', () => {
    expect(normalizeTraceEndpoint('http://localhost:4318/')).toBe(
      'http://localhost:4318/v1/traces',
    );
    expect(
      normalizeTraceEndpoint('https://otel.example/v1/traces?secret=x'),
    ).toBe('https://otel.example/v1/traces');
  });

  it('rejects browser identifiers and embedded endpoint credentials', () => {
    expect(() =>
      validateConfig({
        environment: 'production',
        projectKey: 'obs_pub_not-a-private-key',
        serviceName: 'demo-server',
      }),
    ).toThrow('obs_live_');
    expect(() =>
      normalizeTraceEndpoint('https://user:pass@otel.example'),
    ).toThrow('embedded credentials');
  });

  it('does not expose the Project Key as a resource configuration value', () => {
    const config = validateConfig({
      endpoint: 'http://collector:4318',
      environment: 'development',
      projectKey: 'obs_live_abcdefghijklmnopqrstuvwxyz',
      serviceName: 'demo-server',
    });

    expect(config).toEqual({
      endpoint: 'http://collector:4318/v1/traces',
      environment: 'development',
      projectKey: 'obs_live_abcdefghijklmnopqrstuvwxyz',
      serviceName: 'demo-server',
    });
  });
});
