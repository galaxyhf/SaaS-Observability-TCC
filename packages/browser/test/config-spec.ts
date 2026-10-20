import { safeAttributes, validateOptions } from '../src/index.js';

const options = {
  projectId: 'obs_pub_demo',
  serviceName: 'demo-browser',
  environment: 'test',
  endpoint: 'https://obs.example.com',
};

describe('Configuração e privacidade browser', () => {
  it('aceita identificador público e origens exatas', () => {
    expect(() =>
      validateOptions({
        ...options,
        propagateToOrigins: ['https://api.example.com'],
      }),
    ).not.toThrow();
  });
  it.each([
    { projectId: 'obs_live_secret' },
    { endpoint: 'https://user:password@obs.example.com' },
    { endpoint: 'https://obs.example.com/path' },
    { endpoint: 'https://obs.example.com?secret=1' },
    { sampleRate: NaN },
    { sampleRate: -1 },
    { sampleRate: 2 },
    { propagateToOrigins: ['https://api.example.com/path'] },
    { propagateToOrigins: ['*'] },
  ])('recusa configuração insegura %j', (override) => {
    expect(() => validateOptions({ ...options, ...override })).toThrow();
  });
  it('remove caminhos, query, fragmento, credenciais, headers e erros antes de exportar', () => {
    expect(
      safeAttributes({
        'http.url':
          'https://user:secret@api.example.com/reset/private-token?email=private#secret',
        'http.method': 'POST',
        'http.status_code': 500,
        'http.request.header.authorization': 'Bearer secret',
        'exception.message': 'password=secret',
        'db.statement': 'select secret',
      }),
    ).toEqual({
      'http.url': 'https://api.example.com',
      'http.method': 'POST',
      'http.status_code': 500,
    });
  });
});
