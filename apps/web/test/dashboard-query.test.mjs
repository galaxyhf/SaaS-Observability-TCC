import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardQuery,
  dashboardLink,
  localDateInput,
} from '../src/lib/dashboard-query.ts';
const now = new Date('2026-10-19T15:00:00.000Z');
test('presets produce precise periods and preserve the filter values', () => {
  for (const [period, hours] of [
    ['1h', 1],
    ['24h', 24],
    ['7d', 168],
  ]) {
    const query = dashboardQuery(
      { period, operation: 'order.process', status: 'ERROR' },
      now,
    );
    assert.equal(
      Date.parse(query.get('to')) - Date.parse(query.get('from')),
      hours * 3600000,
    );
    assert.equal(query.get('operation'), 'order.process');
    assert.equal(query.get('status'), 'ERROR');
    assert.equal(query.has('period'), false);
  }
});
test('custom São Paulo inputs round-trip and exact timestamps keep their seconds', () => {
  const q = dashboardQuery(
    { from: '2026-10-19T09:30', to: '2026-10-19T10:45' },
    now,
  );
  assert.equal(q.get('from'), '2026-10-19T12:30:00.000Z');
  assert.equal(localDateInput(q.get('from')), '2026-10-19T09:30');
  const q2 = dashboardQuery(
    { from: now.toISOString(), to: '2026-10-19T16:00:01.500Z' },
    now,
  );
  assert.equal(q2.get('to'), '2026-10-19T16:00:01.500Z');
});
test('navigation retains the period and project, resets pagination and safely encodes operation names', () => {
  const q = dashboardQuery(
    { page: '5', operation: 'GET /a?x=1&y=2', status: 'ERROR' },
    now,
  );
  const link = dashboardLink(q, 'project', { status: null, sort: 'slowest' });
  const url = new URL(link, 'https://example.test');
  assert.equal(url.searchParams.get('page'), null);
  assert.equal(url.searchParams.get('status'), null);
  assert.equal(url.searchParams.get('project'), 'project');
  assert.equal(url.searchParams.get('operation'), 'GET /a?x=1&y=2');
  assert.equal(url.searchParams.get('from'), q.get('from'));
});
