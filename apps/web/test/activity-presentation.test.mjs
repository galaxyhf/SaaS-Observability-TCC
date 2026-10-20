import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityTitle,
  activityCategory,
  activityExplanation,
  timingBreakdown,
} from '../src/lib/activity-presentation.ts';
test('explains safe routes and configured labels without guessing business intent', () => {
  assert.equal(
    activityTitle('GET /api/products/:id'),
    'Buscar /api/products/:id',
  );
  assert.equal(activityTitle('POST /api/orders'), 'Enviar para /api/orders');
  assert.equal(
    activityTitle('POST /api/orders', {
      'obs.operation.label': 'Finalizar compra',
    }),
    'Finalizar compra',
  );
  assert.equal(
    activityTitle('navigation', { 'http.route': '/editor' }),
    'Navegar para /editor',
  );
  assert.equal(
    activityTitle('HTTP /request'),
    'Requisição HTTP sem rota informada',
  );
  assert.equal(activityCategory('GET /api/products'), 'Requisições');
  assert.equal(activityCategory('navigation'), 'Navegação');
  assert.equal(activityCategory('GET /api/products', 'ERROR'), 'Erros');
  assert.equal(
    activityTitle('GET /dashboard', { 'obs.request.type': 'framework' }),
    'Atualização interna da página',
  );
});
test('uses interval unions, clips spans and distinguishes missing data from zero', () => {
  const startedAt = '2026-10-20T00:00:00.000Z';
  const span = (id, layer, offset, durationMs) => ({
    spanId: id,
    parentSpanId: null,
    name: 'operation',
    kind: 'INTERNAL',
    service: { name: 'site' },
    startedAt: new Date(Date.parse(startedAt) + offset).toISOString(),
    durationMs,
    attributes: layer === 'database' ? { 'db.system': 'postgresql' } : {},
    resourceAttributes: { 'obs.service.type': layer },
  });
  const trace = {
    startedAt,
    durationMs: 100,
    rootSpanName: 'GET /api/products',
    status: 'UNSET',
    spans: [
      span('a', 'server', 0, 80),
      span('b', 'server', 20, 100),
      span('c', 'database', 10, 30),
      span('d', 'database', 20, 30),
    ],
  };
  const parts = timingBreakdown(trace);
  assert.equal(parts.find((p) => p.key === 'server').durationMs, 100);
  assert.equal(parts.find((p) => p.key === 'database').durationMs, 40);
  assert.equal(parts.find((p) => p.key === 'browser').received, false);
  assert.match(activityExplanation(trace), /segundo plano/);
  assert.match(activityExplanation(trace), /servidor/);
  assert(!activityExplanation(trace).includes('sucesso'));
});
