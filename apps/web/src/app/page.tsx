import {
  activityTitle,
  activityCategory,
  environmentLabel,
} from '../lib/activity-presentation';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowDownRight,
  Clock3,
  CircleAlert,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  dateTime,
  duration,
  statusLabel,
  type Overview,
  type Project,
} from '../lib/contracts';
import {
  dashboardLink,
  dashboardPeriod,
  dashboardQuery,
  searchValue,
  type SearchValues,
} from '../lib/dashboard-query';
import { CreateProject } from '../components/account';
import { WorkspaceShell } from '../components/workspace-shell';
import {
  DashboardHeading,
  ProjectSettings,
} from '../components/dashboard-sections';
import { workspaceSection, workspaceHref } from '../lib/workspace-navigation';
import { DashboardFilters } from '../components/dashboard-filters';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  const params = await searchParams;
  const value = (key: string) => searchValue(params, key);
  const projects = await api<Project[]>('/projects');
  const project =
    projects.find((item) => item.id === value('project')) || projects[0];
  if (!project)
    return (
      <WorkspaceShell>
        <div className="heading">
          <div>
            <p className="breadcrumb">Seu workspace</p>
            <h1>Vamos acompanhar sua aplicação?</h1>
            <p className="muted">
              Comece com um projeto. Depois, acompanhe o que acontece nele.
            </p>
          </div>
        </div>
        <section className="onboarding panel">
          <span className="empty-icon">
            <Radio size={28} />
          </span>
          <h2>Conecte sua primeira aplicação</h2>
          <p className="muted">
            Dê um nome ao projeto para gerar a chave de conexão. Ela será usada
            no servidor da sua aplicação.
          </p>
          <CreateProject />
        </section>
      </WorkspaceShell>
    );
  const section = workspaceSection(value('view'));
  if (section === 'project') {
    const context = new URLSearchParams();
    for (const key of [
      'project',
      'from',
      'to',
      'period',
      'operation',
      'category',
      'environmentId',
      'serviceId',
      'status',
      'minDurationMs',
      'sort',
      'page',
    ])
      if (value(key)) context.set(key, value(key));
    return (
      <WorkspaceShell
        projectId={project.id}
        section={section}
        dashboardHref={`/?${context}`}
      >
        <DashboardHeading
          projects={projects}
          project={project}
          section={section}
        />
        <ProjectSettings project={project} />
      </WorkspaceShell>
    );
  }
  const query = dashboardQuery(params);
  const [overview, services] = await Promise.all([
    api<Overview>(`/projects/${project.id}/traces?${query}`),
    api<{ id: string; name: string; environmentId: string }[]>(
      `/projects/${project.id}/services`,
    ),
  ]);
  query.set('from', overview.from);
  query.set('to', overview.to);
  query.set('view', section);
  query.set('period', dashboardPeriod(params));
  const href = (changes: Record<string, string | null> = {}) =>
    dashboardLink(query, project.id, changes);
  const back = href({ page: String(overview.page) });
  const { summary } = overview;
  const hasFilters = [
    'category',
    'operation',
    'status',
    'serviceId',
    'environmentId',
    'minDurationMs',
  ].some((key) => value(key));
  const hasReceivedData = services.length > 0;
  const maxVolume = Math.max(1, ...overview.series.map((point) => point.total));
  const errorRate = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(summary.total ? (summary.errors / summary.total) * 100 : 0);
  const values = Object.fromEntries(
    [
      'from',
      'to',
      'period',
      'operation',
      'category',
      'environmentId',
      'serviceId',
      'status',
      'minDurationMs',
      'sort',
    ].map((key) => [key, value(key)]),
  );
  const view =
    value('status') === 'ERROR'
      ? 'errors'
      : value('sort') === 'slowest' && value('minDurationMs') === '1000'
        ? 'slow'
        : 'all';
  return (
    <WorkspaceShell
      projectId={project.id}
      section={section}
      dashboardHref={back}
    >
      <DashboardHeading
        projects={projects}
        project={project}
        section={section}
      />
      <DashboardFilters
        key={`${project.id}:${query.toString()}`}
        section={section}
        project={project}
        services={services}
        values={values}
        from={overview.from}
        to={overview.to}
      />
      <p className="period">
        {dateTime(overview.from)} — {dateTime(overview.to)} · São Paulo
        {hasFilters ? ' · Visão filtrada' : ''}
      </p>
      {section === 'overview' && (
        <>
          <section className="overview-strip" aria-label="Resumo do período">
            <div>
              <div className="metric-label">
                <Radio size={16} aria-hidden="true" />
                Atividades registradas
              </div>
              <strong>{summary.total.toLocaleString('pt-BR')}</strong>
              <p>Execuções acompanhadas no período</p>
            </div>
            <div>
              <div className="metric-label">
                <CircleAlert size={16} aria-hidden="true" />
                Atividades com falha
              </div>
              <strong className={summary.errors ? 'error-ink' : ''}>
                {summary.errors.toLocaleString('pt-BR')}
                <small>{errorRate}% do total</small>
              </strong>
              <Link href={href({ status: 'ERROR', view: 'activities' })}>
                Investigar falhas <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
            <div>
              <div className="metric-label">
                <Clock3 size={16} aria-hidden="true" />
                Tempo de resposta típico
              </div>
              <strong>{duration(summary.p50)}</strong>
              <p>Metade das atividades levou até esse tempo</p>
            </div>
          </section>
          <div className="insights-grid">
            <section className="panel activity-chart">
              <div className="section-title">
                <div>
                  <h2>Atividade ao longo do tempo</h2>
                  <p className="muted">
                    Volume de execuções e falhas no período selecionado.
                  </p>
                </div>
                <span className="chart-legend">
                  <i />
                  Atividades
                  <i className="error-dot" />
                  Falhas
                </span>
              </div>
              <div
                className="volume"
                role="img"
                aria-label={`${summary.total} atividades, ${summary.errors} com falha. Valores por horário disponíveis na tabela abaixo.`}
              >
                {Array.from({ length: 24 }, (_, bucket) => {
                  const point = overview.series.find(
                    (item) => item.bucket === bucket,
                  );
                  const total = point?.total || 0,
                    errors = point?.errors || 0;
                  const start = new Date(
                    Date.parse(overview.from) +
                      (bucket *
                        (Date.parse(overview.to) - Date.parse(overview.from))) /
                        24,
                  ).toISOString();
                  return (
                    <div
                      key={bucket}
                      title={`${dateTime(start)}: ${total} atividades, ${errors} falhas`}
                    >
                      <span
                        className="volume-good"
                        style={{
                          height: `${((total - errors) / maxVolume) * 100}%`,
                        }}
                      />
                      <span
                        className="volume-error"
                        style={{ height: `${(errors / maxVolume) * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="chart-axis">
                <span>{dateTime(overview.from)}</span>
                <span>{dateTime(overview.to)}</span>
              </div>
              <details className="technical-details">
                <summary>Ver valores por horário</summary>
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      Atividade em 24 intervalos, no horário de São Paulo
                    </caption>
                    <thead>
                      <tr>
                        <th>Horário</th>
                        <th>Atividades</th>
                        <th>Falhas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 24 }, (_, bucket) => {
                        const point = overview.series.find(
                          (item) => item.bucket === bucket,
                        );
                        return (
                          <tr key={bucket}>
                            <td>
                              {dateTime(
                                new Date(
                                  Date.parse(overview.from) +
                                    (bucket *
                                      (Date.parse(overview.to) -
                                        Date.parse(overview.from))) /
                                      24,
                                ).toISOString(),
                              )}
                            </td>
                            <td>{point?.total || 0}</td>
                            <td>{point?.errors || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <section className="panel slow-panel">
              <div className="section-title">
                <div>
                  <h2>Onde demora mais</h2>
                  <p className="muted">
                    Atividades com os maiores tempos de resposta.
                  </p>
                </div>
              </div>
              {overview.operations.length ? (
                <ol className="slow-list">
                  {overview.operations.slice(0, 5).map((op) => (
                    <li key={activityTitle(op.name)}>
                      <Link
                        href={href({
                          operation: op.name,
                          sort: 'slowest',
                          view: 'activities',
                        })}
                      >
                        <span>
                          <strong>{activityTitle(op.name)}</strong>
                          <small>
                            {op.total.toLocaleString('pt-BR')} execuções ·{' '}
                            {op.errors} {op.errors === 1 ? 'falha' : 'falhas'}
                          </small>
                        </span>
                        <span className="numeric">
                          {duration(op.p95)}
                          <ArrowDownRight size={14} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="inline-empty">
                  Quando houver atividades, você verá aqui onde o tempo foi
                  gasto.
                </p>
              )}
              <p className="helper">
                Tempo em que 95% das execuções terminaram (p95). Nomes iguais
                são agrupados.
              </p>
            </section>
          </div>
          <div className="actions">
            <Link
              className="button primary"
              href={href({ view: 'activities' })}
            >
              Explorar todas as atividades{' '}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
      {section === 'activities' && (
        <section className="panel activities-panel" id="activities">
          <div className="section-title">
            <div>
              <h2>Explore as atividades</h2>
              <p className="muted">
                Navegação, requisições e erros aparecem identificados.
                Requisições também podem ocorrer em segundo plano.
              </p>
            </div>
            <span className="count-label">
              {summary.total.toLocaleString('pt-BR')} resultados
            </span>
          </div>
          <nav
            className="view-tabs"
            aria-label="Filtrar por resultado e duração"
          >
            <Link
              aria-current={view === 'all' ? 'page' : undefined}
              href={href({ status: null, minDurationMs: null, sort: null })}
            >
              Todas
            </Link>
            <Link
              aria-current={view === 'errors' ? 'page' : undefined}
              href={href({ status: 'ERROR', minDurationMs: null, sort: null })}
            >
              Com falha
            </Link>
            <Link
              aria-current={view === 'slow' ? 'page' : undefined}
              href={href({
                status: null,
                minDurationMs: '1000',
                sort: 'slowest',
              })}
            >
              Mais demoradas <span>≥ 1 s</span>
            </Link>
          </nav>
          {!overview.items.length ? (
            <div className="empty">
              <span className="empty-icon">
                <Radio size={24} aria-hidden="true" />
              </span>
              <h3>
                {hasFilters || hasReceivedData
                  ? 'Nenhuma atividade neste período'
                  : 'Aguardando as primeiras atividades'}
              </h3>
              <p>
                {hasFilters || hasReceivedData
                  ? 'Experimente outro período ou remova os filtros para encontrar mais resultados.'
                  : 'Conecte sua aplicação com a chave do projeto e faça uma operação. As execuções aparecerão aqui assim que forem recebidas.'}
              </p>
              <Link
                className="button"
                href={
                  hasFilters || hasReceivedData
                    ? href({
                        operation: null,
                        category: null,
                        environmentId: null,
                        serviceId: null,
                        status: null,
                        minDurationMs: null,
                        from: null,
                        to: null,
                        period: '24h',
                        sort: null,
                      })
                    : workspaceHref(back, project.id, 'project')
                }
              >
                {hasFilters || hasReceivedData
                  ? 'Ver últimas 24 horas'
                  : 'Como conectar a aplicação'}
              </Link>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Resultado</th>
                    <th>Tempo de resposta</th>
                    <th>Quando aconteceu</th>
                    <th>
                      <span className="sr-only">Detalhes</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.items.map((trace) => (
                    <tr key={trace.traceId}>
                      <td>
                        <Link
                          className="activity-name"
                          href={`/projects/${project.id}/traces/${trace.traceId}?back=${encodeURIComponent(back)}`}
                        >
                          {activityTitle(
                            trace.rootSpanName,
                            trace.rootAttributes,
                          )}
                        </Link>
                        <small>
                          {activityCategory(trace.rootSpanName, trace.status)} ·{' '}
                          {environmentLabel(trace.environmentName)}
                        </small>
                        <small>
                          {trace.serviceName || 'Serviço não informado'}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`status ${trace.status.toLowerCase()}`}
                        >
                          {statusLabel(trace.status)}
                        </span>
                      </td>
                      <td className="numeric">
                        <span className="duration-cell">
                          {duration(trace.durationMs)}
                          <span className="duration-meter" aria-hidden="true">
                            <i
                              style={{
                                width: `${Math.max(3, Math.min(100, (trace.durationMs / Math.max(summary.p95 || 1, 1)) * 100))}%`,
                              }}
                            />
                          </span>
                        </span>
                      </td>
                      <td className="numeric">{dateTime(trace.startedAt)}</td>
                      <td>
                        <Link
                          className="row-open"
                          aria-label={`Ver detalhes de ${trace.rootSpanName || 'atividade'}`}
                          href={`/projects/${project.id}/traces/${trace.traceId}?back=${encodeURIComponent(back)}`}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav className="pagination" aria-label="Paginação">
            <span>
              Página {overview.page} · {overview.pageSize} por página
            </span>
            <div>
              {overview.page > 1 && (
                <Link
                  className="button"
                  href={href({ page: String(overview.page - 1) })}
                >
                  Anterior
                </Link>
              )}
              {overview.page * overview.pageSize < summary.total &&
                overview.page < 1000 && (
                  <Link
                    className="button"
                    href={href({ page: String(overview.page + 1) })}
                  >
                    Próxima <ArrowRight size={14} />
                  </Link>
                )}
            </div>
          </nav>
        </section>
      )}
      {section === 'overview' && (
        <details className="panel technical-details">
          <summary>Indicadores detalhados de desempenho</summary>
          <p className="muted">
            Os percentis mostram o tempo em que uma parcela das atividades
            terminou. Eles consideram todos os resultados filtrados.
          </p>
          <dl className="percentiles">
            <div>
              <dt>50% terminaram em até · p50</dt>
              <dd>{duration(summary.p50)}</dd>
            </div>
            <div>
              <dt>95% terminaram em até · p95</dt>
              <dd>{duration(summary.p95)}</dd>
            </div>
            <div>
              <dt>99% terminaram em até · p99</dt>
              <dd>{duration(summary.p99)}</dd>
            </div>
          </dl>
        </details>
      )}
    </WorkspaceShell>
  );
}
