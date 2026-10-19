export default function Loading() {
  return (
    <main className="workspace" aria-busy="true">
      <p role="status">Carregando as atividades da aplicação…</p>
      <div className="skeleton" />
      <div className="skeleton skeleton-wide" />
      <div className="skeleton skeleton-wide" />
    </main>
  );
}
