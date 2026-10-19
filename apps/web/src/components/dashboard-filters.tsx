'use client';
import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { localDateInput } from '../lib/dashboard-query';
import type { Project } from '../lib/contracts';

export function DashboardFilters({
  project,
  section,
  services,
  values,
  from,
  to,
}: {
  project: Project;
  section: 'overview' | 'activities';
  services: { id: string; name: string; environmentId: string }[];
  values: Record<string, string>;
  from: string;
  to: string;
}) {
  const interval = Date.parse(to) - Date.parse(from);
  const matchingPreset =
    interval === 3600000
      ? '1h'
      : interval === 86400000
        ? '24h'
        : interval === 604800000
          ? '7d'
          : 'custom';
  const [period, setPeriod] = useState(
    values.from || values.to ? matchingPreset : values.period || '24h',
  );
  const [periodChanged, setPeriodChanged] = useState(false);
  const advanced = ['serviceId', 'status', 'minDurationMs', 'sort'].filter(
    (key) => values[key],
  ).length;
  return (
    <form action="/" className="filter-form">
      <input type="hidden" name="project" value={project.id} />
      <input type="hidden" name="view" value={section} />
      {period !== 'custom' && !periodChanged && values.from && values.to && (
        <>
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
        </>
      )}
      <div className="filter-toolbar">
        <label className="search-field">
          <span className="sr-only">Buscar atividade</span>
          <Search size={17} aria-hidden="true" />
          <input
            name="operation"
            placeholder="Buscar uma atividade…"
            maxLength={512}
            defaultValue={values.operation}
          />
        </label>
        <label>
          Período
          <select
            name="period"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setPeriodChanged(true);
            }}
          >
            <option value="1h">Última hora</option>
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="custom">Escolher datas</option>
          </select>
        </label>
        <label>
          Ambiente
          <select name="environmentId" defaultValue={values.environmentId}>
            <option value="">Todos os ambientes</option>
            {project.environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary">Atualizar visão</button>
      </div>
      {period === 'custom' && (
        <fieldset className="custom-period">
          <legend>
            Datas no horário de São Paulo · intervalo máximo de 31 dias
          </legend>
          <label>
            De
            <input
              type="datetime-local"
              name="from"
              defaultValue={localDateInput(from)}
              required
            />
          </label>
          <label>
            Até
            <input
              type="datetime-local"
              name="to"
              defaultValue={localDateInput(to)}
              required
            />
          </label>
        </fieldset>
      )}
      <details className="advanced-filters">
        <summary>
          <SlidersHorizontal size={15} aria-hidden="true" /> Mais filtros
          {advanced > 0 ? ` (${advanced})` : ''}
        </summary>
        <div className="filter-toolbar">
          <label>
            Parte da aplicação
            <select name="serviceId" defaultValue={values.serviceId}>
              <option value="">Todos os serviços</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ·{' '}
                  {
                    project.environments.find(
                      (env) => env.id === service.environmentId,
                    )?.name
                  }
                </option>
              ))}
            </select>
          </label>
          <label>
            Resultado
            <select name="status" defaultValue={values.status}>
              <option value="">Todos os resultados</option>
              <option value="ERROR">Com falha</option>
              <option value="OK">Sucesso confirmado</option>
              <option value="UNSET">Sem resultado informado</option>
            </select>
          </label>
          <label>
            Tempo mínimo (ms)
            <input
              name="minDurationMs"
              type="number"
              min="0"
              max="86400000"
              step="any"
              defaultValue={values.minDurationMs}
              placeholder="Ex.: 1000"
            />
          </label>
          <label>
            Ordem
            <select name="sort" defaultValue={values.sort || 'recent'}>
              <option value="recent">Mais recentes</option>
              <option value="slowest">Mais demoradas</option>
            </select>
          </label>
          <Link
            className="text-link"
            href={`/?project=${project.id}&view=${section}`}
          >
            Limpar filtros
          </Link>
        </div>
      </details>
    </form>
  );
}
