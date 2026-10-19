'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="workspace error-state">
      <h1>Não foi possível carregar os dados</h1>
      <p role="alert">
        A conexão pode estar indisponível ou o período escolhido pode ser
        inválido. Tente novamente ou escolha um período de até 31 dias.
      </p>
      <div className="actions">
        <button onClick={reset}>Tentar novamente</button>
        <Link href="/">Limpar filtros</Link>
      </div>
    </main>
  );
}
