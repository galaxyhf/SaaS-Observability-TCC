export type SearchValues = Record<string, string | string[] | undefined>;
export const searchValue = (params: SearchValues, name: string) =>
  typeof params[name] === 'string' ? (params[name] as string) : '';
export function dashboardQuery(
  params: SearchValues,
  now = new Date(),
): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of [
    'from',
    'to',
    'environmentId',
    'serviceId',
    'status',
    'operation',
    'category',
    'minDurationMs',
    'sort',
    'page',
  ]) {
    const value = searchValue(params, key);
    if (value) query.set(key, value);
  }
  for (const key of ['from', 'to']) {
    const value = query.get(key);
    // Custom date inputs are explicitly in São Paulo, matching the displayed dates.
    if (value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
      query.set(key, new Date(`${value}:00-03:00`).toISOString());
  }
  if (!query.has('from') && !query.has('to')) {
    const hours =
      searchValue(params, 'period') === '1h'
        ? 1
        : searchValue(params, 'period') === '7d'
          ? 168
          : 24;
    query.set('from', new Date(now.getTime() - hours * 3600000).toISOString());
    query.set('to', now.toISOString());
  }
  return query;
}
export function dashboardLink(
  query: URLSearchParams,
  project: string,
  changes: Record<string, string | null> = {},
) {
  const next = new URLSearchParams(query);
  next.set('project', project);
  next.delete('page');
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return `/?${next}`;
}
export function localDateInput(value: string) {
  return new Date(Date.parse(value) - 3 * 3600000).toISOString().slice(0, 16);
}

export function dashboardPeriod(
  params: SearchValues,
): '1h' | '24h' | '7d' | 'custom' {
  const selected = searchValue(params, 'period');
  if (
    selected === '1h' ||
    selected === '24h' ||
    selected === '7d' ||
    selected === 'custom'
  )
    return selected;
  const from = searchValue(params, 'from');
  const to = searchValue(params, 'to');
  if (!from && !to) return '24h';
  const interval = Date.parse(to) - Date.parse(from);
  return interval === 3600000
    ? '1h'
    : interval === 86400000
      ? '24h'
      : interval === 604800000
        ? '7d'
        : 'custom';
}

/** Uma atualização relativa avança até agora; datas fixas só acompanham o modo custom. */
export function dashboardFilterQuery(values: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams();
  const period = values.get('period') || '24h';
  for (const key of [
    'project',
    'view',
    'period',
    'operation',
    'category',
    'environmentId',
    'serviceId',
    'status',
    'minDurationMs',
    'sort',
    'from',
    'to',
  ]) {
    const value = values.get(key)?.trim();
    if (
      !value ||
      (key === 'sort' && value === 'recent') ||
      (key === 'minDurationMs' && Number(value) === 0)
    )
      continue;
    if ((key === 'from' || key === 'to') && period !== 'custom') continue;
    result.set(key, value);
  }
  return result;
}

export function advancedFilterCount(values: Record<string, string>): number {
  return (
    ['serviceId', 'status', 'category'].filter((key) => values[key]).length +
    (Number(values.minDurationMs) > 0 ? 1 : 0) +
    (values.sort === 'slowest' ? 1 : 0)
  );
}
