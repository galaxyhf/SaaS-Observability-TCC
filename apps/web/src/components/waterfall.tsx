'use client';
import { useState } from 'react';
import { duration, statusLabel, type TraceDetail } from '../lib/contracts';
import { waterfallRows } from '../lib/waterfall';

export function Waterfall({ trace }: { trace: TraceDetail }) {
  const [selected, setSelected] = useState<string | null>(null);
  const rows = waterfallRows(trace.spans, trace.startedAt, trace.durationMs);
  const span = trace.spans.find((item) => item.spanId === selected);
  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>Waterfall</h2>
          <span className="muted">
            {trace._count.spans} spans · selecione para inspecionar
          </span>
        </div>
        {trace.truncated && (
          <p className="error-message" role="status">
            Exibindo os primeiros 2.000 spans. A hierarquia pode estar
            incompleta.
          </p>
        )}
        {rows.some((row) => row.incomplete) && (
          <p className="muted">
            * Pai ausente ou hierarquia cíclica. O span foi preservado na
            visualização.
          </p>
        )}
        <div className="table-scroll">
          <div className="waterfall">
            <div className="waterfall-scale">
              <span>Serviço / operação</span>
              <span>0 ms</span>
              <span>{duration(trace.durationMs)}</span>
            </div>
            {rows.map((row) => (
              <button
                className="span-row"
                key={row.span.spanId}
                aria-pressed={selected === row.span.spanId}
                onClick={() => setSelected(row.span.spanId)}
              >
                <span
                  className="span-name"
                  style={{ paddingLeft: `${Math.min(row.depth, 12) * 12}px` }}
                >
                  <small>
                    {row.span.service.name} · {statusLabel(row.span.statusCode)}
                  </small>
                  <strong>
                    {row.span.name}
                    {row.incomplete ? ' *' : ''}
                  </strong>
                  <small>{duration(row.span.durationMs)}</small>
                </span>
                <span className="span-track">
                  <span
                    className={`span-bar ${row.span.statusCode === 'ERROR' ? 'failed' : ''}`}
                    style={{ left: `${row.offset}%`, width: `${row.width}%` }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
        {!rows.length && (
          <p className="empty">Nenhum span disponível neste trace.</p>
        )}
      </section>
      <section
        className="panel span-detail"
        aria-label="Detalhes do span"
        aria-live="polite"
      >
        {span ? (
          <>
            <h2>{span.name}</h2>
            <dl className="span-fields">
              <div>
                <dt>Span ID</dt>
                <dd className="mono">{span.spanId}</dd>
              </div>
              <div>
                <dt>Pai</dt>
                <dd className="mono">{span.parentSpanId || 'Raiz'}</dd>
              </div>
              <div>
                <dt>Serviço</dt>
                <dd>{span.service.name}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{span.kind}</dd>
              </div>
              <div>
                <dt>Duração</dt>
                <dd>{duration(span.durationMs)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel(span.statusCode)}</dd>
              </div>
            </dl>
            {span.statusMessage && (
              <p className="error-message">{span.statusMessage}</p>
            )}
            {[
              ['Atributos', span.attributes],
              ['Recurso', span.resourceAttributes],
              ['Eventos', span.events],
              ['Links', span.links],
            ].map(([label, content]) => (
              <details key={String(label)}>
                <summary>{String(label)}</summary>
                <pre>{JSON.stringify(content, null, 2)}</pre>
              </details>
            ))}
          </>
        ) : (
          <>
            <h2>Detalhes do span</h2>
            <p className="muted">
              Selecione uma operação acima para ver atributos, eventos e
              informações de erro.
            </p>
          </>
        )}
      </section>
    </>
  );
}
