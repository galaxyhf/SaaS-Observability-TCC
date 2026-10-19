'use client';
import { useState } from 'react';
import { duration, statusLabel, type TraceDetail } from '../lib/contracts';
import { waterfallRows } from '../lib/waterfall';

export function Waterfall({ trace }: { trace: TraceDetail }) {
  const [selected, setSelected] = useState<string | null>(
    trace.spans.find((item) => item.statusCode === 'ERROR')?.spanId ??
      trace.spans[0]?.spanId ??
      null,
  );
  const rows = waterfallRows(trace.spans, trace.startedAt, trace.durationMs);
  const span = trace.spans.find((item) => item.spanId === selected);
  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>O caminho desta atividade</h2>
          <span className="muted">
            {trace._count.spans} etapas · selecione uma para entender o que
            aconteceu
          </span>
        </div>
        {trace.truncated && (
          <p className="error-message" role="status">
            Exibindo as primeiras 2.000 etapas. A sequência pode estar
            incompleta.
          </p>
        )}
        {rows.some((row) => row.incomplete) && (
          <p className="muted">
            * Algumas relações entre etapas não foram recebidas ou estão
            inconsistentes. As etapas disponíveis continuam visíveis.
          </p>
        )}
        <div className="table-scroll">
          <div className="waterfall">
            <div className="waterfall-scale">
              <span>Parte da aplicação / etapa</span>
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
          <p className="empty">
            As etapas desta atividade ainda não estão disponíveis.
          </p>
        )}
      </section>
      <section
        className="panel span-detail"
        aria-label="Detalhes da etapa"
        aria-live="polite"
      >
        {span ? (
          <>
            <h2>{span.name}</h2>
            <dl className="span-fields">
              <div>
                <dt>Parte da aplicação</dt>
                <dd>{span.service.name}</dd>
              </div>
              <div>
                <dt>Tempo gasto</dt>
                <dd>{duration(span.durationMs)}</dd>
              </div>
              <div>
                <dt>Resultado</dt>
                <dd>{statusLabel(span.statusCode)}</dd>
              </div>
            </dl>
            {span.statusMessage && (
              <p className="error-message">{span.statusMessage}</p>
            )}
            <details>
              <summary>Identificadores técnicos</summary>
              <dl className="span-fields">
                {' '}
                <div>
                  <dt>Identificador da etapa</dt>
                  <dd className="mono">{span.spanId}</dd>
                </div>
                <div>
                  <dt>Etapa anterior</dt>
                  <dd className="mono">
                    {span.parentSpanId || 'Início da atividade'}
                  </dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{span.kind}</dd>
                </div>
              </dl>
            </details>
            {[
              ['Dados adicionais da etapa', span.attributes],
              ['Informações do serviço', span.resourceAttributes],
              ['Eventos', span.events],
              ['Conexões com outras atividades', span.links],
            ].map(([label, content]) => (
              <details key={String(label)}>
                <summary>{String(label)}</summary>
                <pre>{JSON.stringify(content, null, 2)}</pre>
              </details>
            ))}
          </>
        ) : (
          <>
            <h2>Detalhes da etapa</h2>
            <p className="muted">
              Selecione uma etapa acima para ver o tempo gasto e eventuais
              falhas.
            </p>
          </>
        )}
      </section>
    </>
  );
}
