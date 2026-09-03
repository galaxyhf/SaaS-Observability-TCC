import { Activity, Database, RadioTower } from 'lucide-react';

const foundations = [
  {
    description: 'Dashboard Next.js preparado para consumir a API REST.',
    icon: Activity,
    title: 'Visualização',
  },
  {
    description: 'API NestJS com fronteira própria para ingestão OTLP.',
    icon: RadioTower,
    title: 'Ingestão',
  },
  {
    description: 'Persistência gerenciada exclusivamente no Neon PostgreSQL.',
    icon: Database,
    title: 'Armazenamento',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase">
          Plataforma em construção
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Observabilidade que mostra onde o tempo foi gasto.
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          Fundação técnica do MVP baseada em OpenTelemetry, com tracing como
          sinal prioritário.
        </p>
      </div>

      <section
        aria-label="Componentes da fundação"
        className="mt-12 grid gap-4 md:grid-cols-3"
      >
        {foundations.map(({ description, icon: Icon, title }) => (
          <article
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            key={title}
          >
            <Icon aria-hidden="true" className="size-5 text-blue-700" />
            <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
