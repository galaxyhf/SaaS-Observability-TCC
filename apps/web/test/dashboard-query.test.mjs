import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardQuery,
  dashboardLink,
  localDateInput,
  dashboardPeriod,
  dashboardFilterQuery,
  advancedFilterCount,
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

test('refresh advances relative windows and removes defaults without activating filters', () => {
  const old = dashboardQuery({ period: '24h' }, now);
  const form = new URLSearchParams({
    project: 'sqlvault',
    view: 'activities',
    period: '24h',
    from: old.get('from'),
    to: old.get('to'),
    sort: 'recent',
    status: '',
    serviceId: '',
    environmentId: '',
    operation: '',
    minDurationMs: '',
  });
  const refreshed = dashboardFilterQuery(form);
  assert.deepEqual(Object.fromEntries(refreshed), {
    project: 'sqlvault',
    view: 'activities',
    period: '24h',
  });
  const later = new Date(now.getTime() + 60000);
  assert.equal(
    dashboardQuery(Object.fromEntries(refreshed), later).get('to'),
    later.toISOString(),
  );
  assert.equal(advancedFilterCount({ sort: 'recent', minDurationMs: '0' }), 0);
  assert.equal(
    advancedFilterCount({
      status: 'ERROR',
      serviceId: 'service',
      minDurationMs: '1000',
      sort: 'slowest',
    }),
    4,
  );
});
test('refresh preserves selected filters and custom dates, even for a 24-hour custom window', () => {
  const form = new URLSearchParams({
    project: 'sqlvault',
    view: 'overview',
    period: 'custom',
    from: '2026-10-18T09:30',
    to: '2026-10-19T09:30',
    status: 'ERROR',
    serviceId: 'service',
    minDurationMs: '1000',
    sort: 'slowest',
    operation: 'order.process',
    page: '3',
  });
  const refreshed = dashboardFilterQuery(form);
  assert.equal(refreshed.get('page'), null);
  for (const key of [
    'from',
    'to',
    'status',
    'serviceId',
    'minDurationMs',
    'sort',
    'operation',
  ])
    assert.equal(refreshed.get(key), form.get(key));
  assert.equal(dashboardPeriod(Object.fromEntries(refreshed)), 'custom');
  assert.equal(
    dashboardPeriod({
      period: '1h',
      from: '2026-10-18T09:30',
      to: '2026-10-19T09:30',
    }),
    '1h',
  );
  assert.equal(
    dashboardPeriod({ from: '2026-10-18T09:30Z', to: '2026-10-19T09:30Z' }),
    '24h',
  );
});
