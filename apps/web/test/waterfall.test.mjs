import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterfallRows } from '../src/lib/waterfall.ts';
const start = '2026-09-03T12:00:00.000Z';
const span = (spanId, parentSpanId, offset = 0, durationMs = 10) => ({
  spanId,
  parentSpanId,
  startedAt: new Date(Date.parse(start) + offset).toISOString(),
  durationMs,
});
test('orders children under their parent and scales duration', () => {
  const rows = waterfallRows(
    [span('child', 'root', 25, 50), span('root', null, 0, 100)],
    start,
    100,
  );
  assert.deepEqual(
    rows.map((row) => [row.span.spanId, row.depth]),
    [
      ['root', 0],
      ['child', 1],
    ],
  );
  assert.equal(rows[1].offset, 25);
  assert.equal(rows[1].width, 50);
});
test('preserves orphans, cycles and self-references without hanging', () => {
  const rows = waterfallRows(
    [span('a', 'b'), span('b', 'a'), span('c', 'missing'), span('d', 'd')],
    start,
    100,
  );
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((row) => row.span.spanId)).size, 4);
  assert.equal(rows.filter((row) => row.incomplete).length, 3);
});
test('zero duration and out-of-bounds timestamps produce finite, bounded bars', () => {
  for (const duration of [0, 1, 100])
    for (const row of waterfallRows(
      [span('a', null, -100), span('b', null, 200)],
      start,
      duration,
    )) {
      assert.ok(Number.isFinite(row.width));
      assert.ok(row.offset >= 0 && row.offset <= 100);
      assert.ok(row.width >= 0 && row.width + row.offset <= 100);
    }
});
test('handles very deep traces iteratively', () => {
  const spans = Array.from({ length: 2000 }, (_, i) =>
    span(String(i), i ? String(i - 1) : null),
  );
  assert.equal(waterfallRows(spans, start, 100).length, 2000);
});

import { isSameOrigin } from '../src/lib/request-origin.ts';
test('proxy accepts localhost hosts and rejects cross-origin or malformed origins', () => {
  assert.equal(
    isSameOrigin('http://127.0.0.1:3401', '127.0.0.1:3401', 'http:'),
    true,
  );
  assert.equal(
    isSameOrigin(
      'https://observability.example',
      'observability.example',
      'https:',
    ),
    true,
  );
  for (const origin of [
    null,
    'null',
    'https://evil.example',
    'http://[',
    'http://observability.example',
  ]) {
    assert.equal(
      isSameOrigin(origin, 'observability.example', 'https:'),
      false,
    );
  }
});
