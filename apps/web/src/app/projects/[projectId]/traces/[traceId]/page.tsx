import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '../../../../../lib/api';
import {
  dateTime,
  duration,
  statusLabel,
  type TraceDetail,
} from '../../../../../lib/contracts';
import { workspaceHref } from '../../../../../lib/workspace-navigation';
import { WorkspaceShell } from '../../../../../components/workspace-shell';
import { Waterfall } from '../../../../../components/waterfall';

export default async function TracePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; traceId: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { projectId, traceId } = await params;
  if (!/^[a-f0-9-]{36}$/.test(projectId) || !/^[a-f0-9]{32}$/.test(traceId))
    notFound();
  const trace = await api<TraceDetail>(
    `/projects/${projectId}/traces/${traceId}`,
  );
  const { back } = await searchParams;
  const returnUrl =
    typeof back === 'string' && back.startsWith('/?')
      ? workspaceHref(back, projectId, 'activities')
      : workspaceHref('/', projectId, 'activities');
  return (
    <WorkspaceShell
      projectId={projectId}
      section="activities"
      dashboardHref={returnUrl}
    >
      <Link className="trace-back" href={returnUrl}>
        ← Voltar às atividades
      </Link>
      <div className="heading">
        <div>
          <h1>{trace.rootSpanName || 'Atividade em processamento'}</h1>
        </div>
        <span className={`status ${trace.status.toLowerCase()}`}>
          {statusLabel(trace.status)}
        </span>
      </div>
      <p className="muted">
        {trace.environment.name} · {dateTime(trace.startedAt)} (São Paulo) ·{' '}
        {duration(trace.durationMs)}
      </p>
      <div className="trace-intro">
        {trace.status === 'ERROR'
          ? 'Esta atividade teve uma falha. A primeira etapa com erro já está selecionada abaixo.'
          : 'Veja quanto tempo cada parte da aplicação levou. Selecione uma etapa para explorar os detalhes.'}
      </div>
      <details className="technical-details">
        <summary>Identificador da atividade (Trace ID)</summary>
        <p className="mono">{trace.traceId}</p>
      </details>
      <Waterfall trace={trace} />
    </WorkspaceShell>
  );
}
