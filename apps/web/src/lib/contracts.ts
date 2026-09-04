export interface Project {
  id: string;
  name: string;
  environments: { id: string; name: string }[];
}
export interface TraceSummary {
  traceId: string;
  rootSpanName: string | null;
  startedAt: string;
  durationMs: number;
  status: string;
  serviceName: string | null;
  environmentName: string;
}
export interface Overview {
  items: TraceSummary[];
  summary: {
    total: number;
    errors: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  };
  operations: { name: string; total: number; errors: number; p95: number }[];
  series: { bucket: number; total: number; errors: number }[];
  page: number;
  pageSize: number;
  from: string;
  to: string;
}
export interface Span {
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startedAt: string;
  durationMs: number;
  statusCode: string;
  statusMessage: string | null;
  kind: string;
  service: { name: string };
  attributes: unknown;
  resourceAttributes: unknown;
  events: unknown;
  links: unknown;
}
export interface TraceDetail {
  traceId: string;
  rootSpanName: string | null;
  startedAt: string;
  durationMs: number;
  status: string;
  environment: { name: string };
  spans: Span[];
  truncated: boolean;
  _count: { spans: number };
}
export const duration = (value: number | null) =>
  value === null
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)} ms`;
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
export const statusLabel = (value: string) =>
  value === 'ERROR' ? 'Erro' : value === 'OK' ? 'OK' : 'Não definido';
