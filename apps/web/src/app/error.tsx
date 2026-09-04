'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="workspace">
      <h1>Não foi possível carregar os dados</h1>
      <p role="alert">
        Confira a conexão com a API e o período informado nos filtros. O
        intervalo máximo é de 31 dias.
      </p>
      <div className="actions">
        <button onClick={reset}>Tentar novamente</button>
        <Link href="/">Limpar filtros</Link>
      </div>
    </main>
  );
}
