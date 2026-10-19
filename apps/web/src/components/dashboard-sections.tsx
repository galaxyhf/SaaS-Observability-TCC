import { ChevronRight, Plus } from 'lucide-react';
import type { Project } from '../lib/contracts';
import type { WorkspaceSection } from '../lib/workspace-navigation';
import { CreateProject } from './account';
const headings = {
  overview: [
    'Visão geral',
    'Como está sua aplicação?',
    'Acompanhe a atividade e encontre o que precisa de atenção.',
  ],
  activities: [
    'Atividades',
    'Explore as atividades',
    'Encontre uma execução e entenda cada etapa.',
  ],
  project: [
    'Projeto',
    'Configuração do projeto',
    'Consulte a conexão, a retenção do histórico e crie outros projetos.',
  ],
};
export function DashboardHeading({
  projects,
  project,
  section,
}: {
  projects: Project[];
  project: Project;
  section: WorkspaceSection;
}) {
  const [label, title, description] = headings[section];
  return (
    <div className="heading">
      <div>
        <p className="breadcrumb">
          {project.name} <ChevronRight size={13} aria-hidden="true" /> {label}
        </p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <form action="/" className="project-picker">
        <input type="hidden" name="view" value={section} />
        <label>
          <span className="sr-only">Projeto</span>
          <select name="project" defaultValue={project.id}>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button>Abrir projeto</button>
      </form>
    </div>
  );
}
export function ProjectSettings({ project }: { project: Project }) {
  return (
    <section
      className="panel project-settings"
      aria-label="Configuração do projeto"
    >
      <div className="settings-content">
        <div>
          <h2>Conexão e histórico</h2>
          <p>
            As atividades ficam disponíveis por {project.retentionDays ?? 7}{' '}
            dias. Registros antigos são removidos automaticamente em lotes.
          </p>
          <details open>
            <summary>Como enviar atividades</summary>
            <p>
              Use a chave privada gerada na criação do projeto apenas no
              servidor da aplicação. Configure o SDK Node com o nome do serviço,
              o ambiente e o endereço do Collector. A chave não pode ser
              recuperada depois de fechar a criação.
            </p>
          </details>
        </div>
        <div>
          <h2 className="new-project-title">
            <Plus size={16} aria-hidden="true" />
            Novo projeto
          </h2>
          <CreateProject />
        </div>
      </div>
    </section>
  );
}
