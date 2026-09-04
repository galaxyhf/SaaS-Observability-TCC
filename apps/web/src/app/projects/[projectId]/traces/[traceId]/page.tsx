import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '../../../../../lib/api';
import {
  dateTime,
  duration,
  statusLabel,
  type TraceDetail,
} from '../../../../../lib/contracts';
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
      ? back
      : `/?project=${projectId}`;
  return (
    <main className="workspace">
      <Link href={returnUrl}>← Voltar aos traces</Link>
      <div className="heading">
        <div>
          <h1>{trace.rootSpanName || 'Raiz não recebida'}</h1>
          <p className="mono trace-id">{trace.traceId}</p>
        </div>
        <span className={`status ${trace.status.toLowerCase()}`}>
          {statusLabel(trace.status)}
        </span>
      </div>
      <p className="muted">
        {trace.environment.name} · {dateTime(trace.startedAt)} (São Paulo) ·{' '}
        {duration(trace.durationMs)}
      </p>
      <Waterfall trace={trace} />
    </main>
  );
}
