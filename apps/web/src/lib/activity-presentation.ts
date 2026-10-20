import type { Span, TraceDetail } from './contracts.ts';

export function attributes(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function activityCategory(name: string | null, status = '') {
  if (
    status === 'ERROR' ||
    name?.startsWith('browser.error') ||
    name === 'browser.unhandledrejection'
  )
    return 'Erros';
  if (name === 'navigation' || name === 'document.load') return 'Navegação';
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|HTTP) /.test(name || ''))
    return 'Requisições';
  return 'Outras operações';
}
export function activityTitle(name: string | null, raw?: unknown) {
  const data = attributes(raw);
  const route =
    typeof data['http.route'] === 'string' ? data['http.route'] : '';
  if (data['obs.request.type'] === 'framework')
    return 'Atualização interna da página';
  if (
    typeof data['obs.operation.label'] === 'string' &&
    data['obs.operation.label']
  )
    return data['obs.operation.label'];
  if (name === 'navigation')
    return route ? `Navegar para ${route}` : 'Navegação entre páginas';
  if (name === 'document.load')
    return route ? `Carregar página ${route}` : 'Carregamento da página';
  if (name === 'browser.error' || name === 'browser.unhandledrejection')
    return 'Erro no navegador';
  if (name === 'database.query') return 'Consulta ao banco de dados';
  if (name === 'server.operation') return 'Processamento no servidor';
  if (name === 'browser.operation') return 'Operação no navegador';
  const match = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|HTTP) (.+)$/.exec(
    name || '',
  );
  if (match) {
    const path = route || match[2];
    if (
      !path ||
      ['/request', 'request', 'server request', 'client request'].includes(path)
    )
      return 'Requisição HTTP sem rota informada';
    const verb =
      match[1] === 'GET'
        ? 'Buscar'
        : match[1] === 'DELETE'
          ? 'Excluir em'
          : ['PUT', 'PATCH'].includes(match[1] || '')
            ? 'Atualizar em'
            : match[1] === 'POST'
              ? 'Enviar para'
              : 'Requisitar';
    return `${verb} ${path}`;
  }
  return name || 'Atividade em processamento';
}
export const environmentLabel = (name: string) =>
  ({
    development: 'Desenvolvimento',
    production: 'Produção',
    staging: 'Homologação',
    test: 'Teste',
  })[name] || name;
export function spanLayer(
  span: Span,
): 'browser' | 'server' | 'database' | 'other' {
  const data = attributes(span.attributes);
  const resource = attributes(span.resourceAttributes);
  if (
    data['db.system'] ||
    data['db.system.name'] ||
    span.name === 'database.query'
  )
    return 'database';
  if (resource['obs.service.type'] === 'browser') return 'browser';
  if (resource['obs.service.type'] === 'server' || span.kind === 'SERVER')
    return 'server';
  return 'other';
}
export const layerLabels = {
  browser: 'Navegador',
  server: 'Servidor',
  database: 'Banco de dados',
  other: 'Outras etapas',
};
export function activityExplanation(trace: TraceDetail) {
  const root = trace.spans.find((span) => !span.parentSpanId) || trace.spans[0];
  const layers = new Set(trace.spans.map(spanLayer));
  const category = activityCategory(trace.rootSpanName, trace.status);
  const opening =
    trace.rootSpanName === 'document.load'
      ? 'Foi registrado o carregamento de uma página.'
      : trace.rootSpanName === 'navigation'
        ? 'Foi registrada uma mudança de página no navegador.'
        : category === 'Requisições'
          ? 'Foi registrada uma requisição HTTP. Ela pode acontecer durante a navegação ou em segundo plano.'
          : category === 'Erros'
            ? 'Esta atividade contém uma falha registrada.'
            : 'Foi registrada uma operação da aplicação.';
  const code =
    attributes(root?.attributes)['http.response.status_code'] ??
    attributes(root?.attributes)['http.status_code'];
  return `${opening}${typeof code === 'number' ? ` Resposta HTTP ${code}.` : ''}${layers.has('server') ? ' Há etapas do servidor nesta atividade.' : ''}${layers.has('database') ? ' Há consultas instrumentadas ao banco de dados.' : ''}${trace.status === 'ERROR' && category !== 'Erros' ? ' Houve uma falha registrada.' : ''}`;
}

/** Union of intervals, rather than sums: nested/parallel spans are not counted twice. */
export function timingBreakdown(trace: TraceDetail) {
  const start = Date.parse(trace.startedAt);
  const end = start + trace.durationMs;
  const layers = new Map<string, [number, number][]>();
  for (const span of trace.spans) {
    const layer = spanLayer(span);
    const a = Math.max(start, Date.parse(span.startedAt));
    const b = Math.min(end, Date.parse(span.startedAt) + span.durationMs);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) continue;
    const intervals = layers.get(layer) || [];
    intervals.push([a, b]);
    layers.set(layer, intervals);
  }
  return Object.entries(layerLabels).map(([key, label]) => {
    const intervals = (layers.get(key) || []).sort((a, b) => a[0] - b[0]);
    let total = 0,
      until = start;
    for (const [a, b] of intervals) {
      total += Math.max(0, b - Math.max(a, until));
      until = Math.max(until, b);
    }
    return { key, label, durationMs: total, received: layers.has(key) };
  });
}
