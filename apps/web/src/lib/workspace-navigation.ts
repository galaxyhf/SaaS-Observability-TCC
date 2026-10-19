export type WorkspaceSection = 'overview' | 'activities' | 'project';
export function workspaceSection(value: unknown): WorkspaceSection {
  return value === 'activities' || value === 'project' ? value : 'overview';
}
export function workspaceHref(
  href: string,
  projectId: string | undefined,
  section: WorkspaceSection,
): string {
  const query = new URLSearchParams(
    href.startsWith('/?') ? href.slice(2).split('#')[0] : '',
  );
  if (projectId) query.set('project', projectId);
  else query.delete('project');
  query.set('view', section);
  return `/?${query}`;
}
