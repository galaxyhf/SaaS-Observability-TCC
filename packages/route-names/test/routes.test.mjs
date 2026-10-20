import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeMetadata, validateRoutes } from '../src/index.js';
test('normalizes every unknown segment and removes all URL values', () => {
  assert.deepEqual(
    routeMetadata(
      'https://u:pw@host/api/users/alice@example.com/orders/42?token=SECRET#private',
    ),
    { 'http.route': '/api/users/:id/orders/:id' },
  );
  assert.equal(
    routeMetadata('/api/reset/opaqueTOKEN')['http.route'],
    '/api/:id/:id',
  );
  assert.equal(
    routeMetadata('/api/products/1')['http.route'],
    '/api/products/:id',
  );
});
test('uses explicit templates and labels only for matching method and path', () => {
  const routes = [
    { path: '/api/invoices/:id', method: 'POST', label: 'Enviar fatura' },
  ];
  validateRoutes(routes);
  assert.deepEqual(
    routeMetadata('/api/invoices/SECRET?password=SECRET', 'POST', routes),
    {
      'http.route': '/api/invoices/:id',
      'obs.operation.label': 'Enviar fatura',
    },
  );
  assert.equal(
    routeMetadata('/api/invoices/SECRET', 'GET', routes)['obs.operation.label'],
    undefined,
  );
  assert.throws(() => validateRoutes([{ path: '/reset?token=x' }]));
  assert.throws(() => validateRoutes([{ path: '/api', label: '\nsecret' }]));
  assert.equal(
    routeMetadata('/dashboard?_rsc=PRIVATE')['obs.request.type'],
    'framework',
  );
});
