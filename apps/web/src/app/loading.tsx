export default function Loading() {
  return (
    <main className="workspace" aria-busy="true">
      <p role="status">Consultando traces…</p>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </main>
  );
}
