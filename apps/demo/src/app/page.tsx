import { Activity, ArrowRight, RadioTower } from 'lucide-react';

import { ScenarioRunner } from './_components/scenario-runner';

export default function DemoPage(): React.ReactNode {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#main-content">
          <span className="brand-mark">
            <Activity aria-hidden="true" />
          </span>
          <span>
            <strong>TraceLab</strong>
            <small>Aplicação demonstrativa</small>
          </span>
        </a>
        <div className="telemetry-status">
          <span aria-hidden="true" />
          demo-store-server
        </div>
      </header>

      <div className="page-shell" id="main-content">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="context-line">
              Next.js instrumentado
              <ArrowRight aria-hidden="true" />
              OpenTelemetry Collector
              <ArrowRight aria-hidden="true" />
              Plataforma
            </p>
            <h1 id="page-title">
              Gere traces previsíveis para validar a plataforma.
            </h1>
            <p className="intro-copy">
              Cada ação abaixo produz um comportamento específico. Use esta tela
              durante a apresentação para demonstrar latência, erros, banco de
              dados e waterfalls de spans.
            </p>
          </div>
          <div className="runtime-note">
            <RadioTower aria-hidden="true" />
            <div>
              <strong>Exportação server-side</strong>
              <span>OTLP/HTTP · service.name demo-store-server</span>
            </div>
          </div>
        </section>

        <ScenarioRunner />
      </div>
    </main>
  );
}
