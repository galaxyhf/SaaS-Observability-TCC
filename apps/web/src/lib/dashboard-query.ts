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
