import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workspaceSection,
  workspaceHref,
} from '../src/lib/workspace-navigation.ts';

test('sidebar sections have different destinations and keep project, filters, period and page', () => {
  const context =
    '/?project=old&from=2026-10-19T12%3A00%3A00.123Z&to=2026-10-19T13%3A00%3A00.123Z&status=ERROR&operation=GET+%2Fprodutos&page=3';
  const destinations = ['overview', 'activities', 'project'].map((section) =>
    workspaceHref(context, 'current', section),
  );
  assert.equal(new Set(destinations).size, 3);
  for (const [index, href] of destinations.entries()) {
    const url = new URL(href, 'http://localhost');
    assert.equal(
      url.searchParams.get('view'),
      ['overview', 'activities', 'project'][index],
    );
    assert.equal(url.searchParams.get('project'), 'current');
    assert.equal(url.searchParams.get('status'), 'ERROR');
    assert.equal(url.searchParams.get('page'), '3');
    assert.equal(url.searchParams.get('operation'), 'GET /produtos');
    assert.equal(url.searchParams.get('from'), '2026-10-19T12:00:00.123Z');
    assert.equal(url.hash, '');
  }
});
test('detail navigation returns to activities and preserves the exact investigation', () => {
  const back = '/?project=p&view=overview&serviceId=s&sort=slowest&page=2';
  const href = workspaceHref(back, 'p', 'activities');
  assert.equal(
    href,
    '/?project=p&view=activities&serviceId=s&sort=slowest&page=2',
  );
});
test('unrecognized sections fall back to overview and external context cannot become a redirect', () => {
  for (const value of ['', undefined, ['project'], 'unknown'])
    assert.equal(workspaceSection(value), 'overview');
  assert.equal(workspaceSection('activities'), 'activities');
  assert.equal(workspaceSection('project'), 'project');
  assert.equal(
    workspaceHref('https://example.test/?project=other', 'p', 'project'),
    '/?project=p&view=project',
  );
});
