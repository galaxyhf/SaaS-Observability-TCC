import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  Settings2,
  Layers3,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  workspaceHref,
  type WorkspaceSection,
} from '../lib/workspace-navigation';
import { Logout } from './account';

export function WorkspaceShell({
  children,
  projectId,
  section = 'overview',
  dashboardHref = '/',
}: {
  children: ReactNode;
  projectId?: string;
  section?: WorkspaceSection;
  dashboardHref?: string;
}) {
  const home = workspaceHref(dashboardHref, projectId, 'overview');
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link className="brand" href={home}>
          <span className="brand-mark">
            <Activity size={21} aria-hidden="true" />
          </span>
          <span>
            Observa<small>Seu app, por dentro.</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal" className="side-nav">
          {(
            [
              ['overview', 'Visão geral', ChartNoAxesCombined],
              ['activities', 'Atividades', Layers3],
              ['project', 'Projeto', Settings2],
            ] as const
          )
            .filter(([id]) => projectId || id === 'overview')
            .map(([id, label, Icon]) => (
              <Link
                key={id}
                className="nav-item"
                href={workspaceHref(dashboardHref, projectId, id)}
                aria-current={section === id ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" /> {label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-footer">
          <p>
            Encontre o caminho
            <br />
            entre um problema
            <br />e sua causa.
          </p>
          <span>Projeto de observabilidade · TCC</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="app-topbar">
          <span className="topbar-label">Monitoramento da aplicação</span>
          <div className="topbar-account">
            <span className="workspace-label">
              <ArrowUpRight size={14} aria-hidden="true" /> Workspace
            </span>
            <Logout />
          </div>
        </header>
        <main id="main-content" className="workspace">
          {children}
        </main>
      </div>
    </div>
  );
}
