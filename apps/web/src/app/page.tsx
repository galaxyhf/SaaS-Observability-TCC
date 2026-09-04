import Link from 'next/link';
import { Activity } from 'lucide-react';
import { api } from '../lib/api';
import {
  dateTime,
  duration,
  statusLabel,
  type Overview,
  type Project,
} from '../lib/contracts';
import { CreateProject, Logout } from '../components/account';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (name: string) =>
    typeof params[name] === 'string' ? (params[name] as string) : '';
  const projects = await api<Project[]>('/projects');
  const project =
    projects.find((item) => item.id === value('project')) || projects[0];
  if (!project)
    return (
      <main className="workspace">
        <header className="topbar">
          <h1>Seus projetos</h1>
          <Logout />
        </header>
        <section className="panel empty">
          <h2>Conecte sua primeira aplicação</h2>
          <p>
            Crie um projeto e use sua Project Key no SDK Node para começar a
            receber traces.
          </p>
          <CreateProject />
        </section>
      </main>
    );
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
  ])
    if (value(key)) query.set(key, value(key));
  const [overview, services] = await Promise.all([
    api<Overview>(`/projects/${project.id}/traces?${query}`),
    api<{ id: string; name: string; environmentId: string }[]>(
      `/projects/${project.id}/services`,
    ),
  ]);
  const link = (page: number) => {
    const next = new URLSearchParams(query);
    next.set('project', project.id);
    next.set('page', String(page));
    next.set('from', overview.from);
    next.set('to', overview.to);
    return `/?${next}`;
  };
  const back = link(overview.page);
  const { summary } = overview;
  const maxVolume = Math.max(1, ...overview.series.map((item) => item.total));
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          <Activity size={20} aria-hidden="true" /> TCC Observability
        </Link>
        <Logout />
      </header>
      <div className="heading">
        <div>
          <h1>Traces</h1>
          <p className="muted">
            Investigue uma operação, do início ao último span.
          </p>
        </div>
        <form action="/" className="actions">
          <label>
            Projeto
            <select name="project" defaultValue={project.id}>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button>Abrir</button>
        </form>
      </div>
      <form className="filters panel" action="/">
        <input type="hidden" name="project" value={project.id} />
        <label>
          De (UTC)
          <input
            type="datetime-local"
            name="from"
            defaultValue={overview.from.slice(0, 16)}
            required
          />
        </label>
        <label>
          Até (UTC)
          <input
            type="datetime-local"
            name="to"
            defaultValue={overview.to.slice(0, 16)}
            required
          />
        </label>
        <label>
          Ambiente
          <select name="environmentId" defaultValue={value('environmentId')}>
            <option value="">Todos</option>
            {project.environments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Serviço participante
          <select name="serviceId" defaultValue={value('serviceId')}>
            <option value="">Todos</option>
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ·{' '}
                {
                  project.environments.find(
                    (env) => env.id === item.environmentId,
                  )?.name
                }
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={value('status')}>
            <option value="">Todos</option>
            <option value="ERROR">Erro</option>
            <option value="OK">OK</option>
            <option value="UNSET">Não definido</option>
          </select>
        </label>
        <label>
          Operação raiz
          <input
            name="operation"
            placeholder="Buscar operação"
            maxLength={512}
            defaultValue={value('operation')}
          />
        </label>
        <label>
          Duração mínima (ms)
          <input
            name="minDurationMs"
            type="number"
            min="0"
            max="86400000"
            step="any"
            defaultValue={value('minDurationMs')}
          />
        </label>
        <label>
          Ordenar
          <select name="sort" defaultValue={value('sort') || 'recent'}>
            <option value="recent">Mais recentes</option>
            <option value="slowest">Mais lentos</option>
          </select>
        </label>
        <button className="primary">Aplicar filtros</button>
        <Link href={`/?project=${project.id}`}>Últimas 24 horas</Link>
      </form>
      <p className="muted period">
        {dateTime(overview.from)} — {dateTime(overview.to)} (São Paulo).
        Intervalo de até 31 dias.
      </p>
      <dl className="metrics">
        {[
          ['Traces', summary.total.toLocaleString('pt-BR')],
          [
            'Com erro',
            `${summary.errors} (${summary.total ? ((summary.errors / summary.total) * 100).toFixed(1) : '0'}%)`,
          ],
          ['p50', duration(summary.p50)],
          ['p95', duration(summary.p95)],
          ['p99', duration(summary.p99)],
        ].map(([label, text]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <section className="panel">
        <div className="section-title">
          <h2>Volume no período</h2>
          <span className="muted">24 intervalos · dados filtrados</span>
        </div>
        <div
          className="volume"
          role="img"
          aria-label={`${summary.total} traces no período; ${summary.errors} com erro. Distribuição detalhada na tabela abaixo.`}
        >
          {Array.from({ length: 24 }, (_, bucket) => {
            const item = overview.series.find(
              (point) => point.bucket === bucket,
            );
            return (
              <div
                key={bucket}
                title={`Intervalo ${bucket + 1}: ${item?.total || 0} traces, ${item?.errors || 0} com erro`}
              >
                <span
                  style={{
                    height: `${((item?.total || 0) / maxVolume) * 100}%`,
                  }}
                />
              </div>
            );
          })}
        </div>
        <details>
          <summary>Ver distribuição em tabela</summary>
          <table>
            <thead>
              <tr>
                <th>Início (São Paulo)</th>
                <th>Traces</th>
                <th>Com erro</th>
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
        </details>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>Explorar traces</h2>
          <span>{summary.total} resultados</span>
        </div>
        {!overview.items.length ? (
          <div className="empty">
            <h3>Nenhum trace neste recorte</h3>
            <p>
              Amplie o período ou remova filtros. Se ainda não há dados, execute
              um cenário na aplicação demonstrativa com a Project Key deste
              projeto.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Operação / Trace ID</th>
                  <th>Serviço raiz</th>
                  <th>Ambiente</th>
                  <th>Início (São Paulo)</th>
                  <th>Duração</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.items.map((trace) => (
                  <tr key={trace.traceId}>
                    <td>
                      <Link
                        href={`/projects/${project.id}/traces/${trace.traceId}?back=${encodeURIComponent(back)}`}
                      >
                        {trace.rootSpanName || 'Raiz não recebida'}
                      </Link>
                      <small className="mono">{trace.traceId}</small>
                    </td>
                    <td>{trace.serviceName || '—'}</td>
                    <td>{trace.environmentName}</td>
                    <td>{dateTime(trace.startedAt)}</td>
                    <td className="numeric">{duration(trace.durationMs)}</td>
                    <td>
                      <span className={`status ${trace.status.toLowerCase()}`}>
                        {statusLabel(trace.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav className="pagination" aria-label="Paginação">
          {overview.page > 1 ? (
            <Link href={link(overview.page - 1)}>← Anterior</Link>
          ) : (
            <span />
          )}
          <span>Página {overview.page} · até 50 traces</span>
          {overview.page * 50 < summary.total && overview.page < 1000 ? (
            <Link href={link(overview.page + 1)}>Próxima →</Link>
          ) : (
            <span />
          )}
        </nav>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>Operações mais lentas</h2>
          <span className="muted">Até 20 · ordenadas por p95</span>
        </div>
        {overview.operations.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Operação raiz</th>
                  <th>Traces</th>
                  <th>Com erro</th>
                  <th>p95</th>
                </tr>
              </thead>
              <tbody>
                {overview.operations.map((op) => (
                  <tr key={op.name}>
                    <td>{op.name}</td>
                    <td>{op.total}</td>
                    <td>{op.errors}</td>
                    <td>{duration(op.p95)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            As operações aparecerão quando houver traces neste período.
          </p>
        )}
      </section>
      <details className="panel">
        <summary>Criar outro projeto</summary>
        <CreateProject />
      </details>
    </main>
  );
}
