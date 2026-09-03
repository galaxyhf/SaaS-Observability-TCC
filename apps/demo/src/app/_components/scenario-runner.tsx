'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Database,
  LoaderCircle,
  PackageCheck,
  Play,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

type ScenarioId = 'fast' | 'slow' | 'error' | 'database' | 'order';

interface Scenario {
  description: string;
  endpoint: string;
  expected: string;
  icon: LucideIcon;
  id: ScenarioId;
  method: 'GET' | 'POST';
  title: string;
}

interface ExecutionResult {
  body: unknown;
  durationMs: number;
  finishedAt: string;
  scenario: ScenarioId;
  status: number;
  statusText: string;
}

const scenarios: Scenario[] = [
  {
    description:
      'Retorna imediatamente e cria uma referência de latência normal.',
    endpoint: '/api/fast',
    expected: 'HTTP 200 com baixa latência',
    icon: CircleGauge,
    id: 'fast',
    method: 'GET',
    title: 'Requisição rápida',
  },
  {
    description:
      'Aguarda 900 ms antes da resposta para aparecer entre as operações lentas.',
    endpoint: '/api/slow',
    expected: 'HTTP 200 em aproximadamente 900 ms',
    icon: Clock3,
    id: 'slow',
    method: 'GET',
    title: 'Requisição lenta',
  },
  {
    description:
      'Registra uma exceção controlada e devolve uma resposta HTTP 500.',
    endpoint: '/api/error',
    expected: 'Span e trace com status de erro',
    icon: AlertTriangle,
    id: 'error',
    method: 'GET',
    title: 'Erro proposital',
  },
  {
    description:
      'Consulta o PostgreSQL e retorna a quantidade de pedidos persistidos.',
    endpoint: '/api/database',
    expected: 'Span automático do driver pg',
    icon: Database,
    id: 'database',
    method: 'GET',
    title: 'Consulta ao banco',
  },
  {
    description:
      'Valida, consulta estoque, autoriza pagamento e persiste um pedido.',
    endpoint: '/api/order',
    expected: 'Waterfall com spans manuais e PostgreSQL',
    icon: PackageCheck,
    id: 'order',
    method: 'POST',
    title: 'Processar pedido',
  },
];

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function ScenarioRunner(): React.ReactNode {
  const [active, setActive] = useState<ScenarioId | null>(null);
  const [loading, setLoading] = useState<ScenarioId | null>(null);
  const [results, setResults] = useState<
    Partial<Record<ScenarioId, ExecutionResult>>
  >({});

  const selectedResult = active ? results[active] : undefined;

  async function execute(scenario: Scenario): Promise<void> {
    setActive(scenario.id);
    setLoading(scenario.id);
    const startedAt = performance.now();

    try {
      const response = await fetch(scenario.endpoint, {
        body:
          scenario.method === 'POST'
            ? JSON.stringify({ quantity: 2 })
            : undefined,
        headers:
          scenario.method === 'POST'
            ? { 'content-type': 'application/json' }
            : undefined,
        method: scenario.method,
      });
      const body = await responseBody(response);
      setResults((current) => ({
        ...current,
        [scenario.id]: {
          body,
          durationMs: Math.round(performance.now() - startedAt),
          finishedAt: new Date().toLocaleTimeString('pt-BR'),
          scenario: scenario.id,
          status: response.status,
          statusText: response.statusText,
        },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [scenario.id]: {
          body: {
            error:
              error instanceof Error
                ? error.message
                : 'Não foi possível alcançar a aplicação.',
          },
          durationMs: Math.round(performance.now() - startedAt),
          finishedAt: new Date().toLocaleTimeString('pt-BR'),
          scenario: scenario.id,
          status: 0,
          statusText: 'Falha de rede',
        },
      }));
    } finally {
      setLoading(null);
    }
  }

  function reset(): void {
    setActive(null);
    setResults({});
  }

  return (
    <div className="runner-layout">
      <section aria-labelledby="scenarios-title" className="scenario-panel">
        <div className="section-heading">
          <div>
            <h2 id="scenarios-title">Cenários disponíveis</h2>
            <p>
              Execute um por vez e compare o resultado com o trace recebido.
            </p>
          </div>
          <button
            className="reset-button"
            disabled={Object.keys(results).length === 0 || loading !== null}
            onClick={reset}
            type="button"
          >
            <RotateCcw aria-hidden="true" />
            Limpar
          </button>
        </div>

        <div className="scenario-list">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            const result = results[scenario.id];
            const isLoading = loading === scenario.id;

            return (
              <article className="scenario-row" key={scenario.id}>
                <div className="scenario-icon" data-tone={scenario.id}>
                  <Icon aria-hidden="true" />
                </div>
                <div className="scenario-copy">
                  <div className="scenario-title-line">
                    <h3>{scenario.title}</h3>
                    <code>
                      {scenario.method} {scenario.endpoint}
                    </code>
                  </div>
                  <p>{scenario.description}</p>
                  <span className="expected">
                    Esperado: {scenario.expected}
                  </span>
                </div>
                <div className="scenario-action">
                  {result ? (
                    <span
                      className="last-status"
                      data-ok={result.status > 0 && result.status < 400}
                    >
                      {result.status || 'offline'} · {result.durationMs} ms
                    </span>
                  ) : null}
                  <button
                    aria-label={`Executar ${scenario.title}`}
                    className="run-button"
                    disabled={loading !== null}
                    onClick={() => void execute(scenario)}
                    type="button"
                  >
                    {isLoading ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="loading-icon"
                      />
                    ) : (
                      <Play aria-hidden="true" />
                    )}
                    {isLoading ? 'Executando' : 'Executar'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside aria-labelledby="result-title" className="result-panel">
        <div className="result-header">
          <div>
            <span>Última execução</span>
            <h2 id="result-title">
              {active
                ? scenarios.find((scenario) => scenario.id === active)?.title
                : 'Nenhum cenário executado'}
            </h2>
          </div>
          {selectedResult ? (
            selectedResult.status > 0 && selectedResult.status < 400 ? (
              <CheckCircle2
                aria-label="Execução concluída"
                className="result-ok"
              />
            ) : (
              <AlertTriangle
                aria-label="Execução com erro"
                className="result-error"
              />
            )
          ) : null}
        </div>

        {loading ? (
          <div aria-live="polite" className="result-empty">
            <LoaderCircle aria-hidden="true" className="loading-icon" />
            <p>Aguardando a resposta de {loading}…</p>
          </div>
        ) : selectedResult ? (
          <div aria-live="polite" className="result-content">
            <dl>
              <div>
                <dt>Status HTTP</dt>
                <dd>{selectedResult.status || selectedResult.statusText}</dd>
              </div>
              <div>
                <dt>Duração percebida</dt>
                <dd>{selectedResult.durationMs} ms</dd>
              </div>
              <div>
                <dt>Finalizado às</dt>
                <dd>{selectedResult.finishedAt}</dd>
              </div>
            </dl>
            <div className="response-block">
              <span>Resposta</span>
              <pre>{JSON.stringify(selectedResult.body, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <div className="result-empty">
            <Play aria-hidden="true" />
            <p>
              Escolha um cenário para inspecionar status, duração e payload.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
