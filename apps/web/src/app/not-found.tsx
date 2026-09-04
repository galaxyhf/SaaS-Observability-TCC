import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="workspace">
      <h1>Registro não encontrado</h1>
      <p>O projeto ou trace não está disponível para sua conta.</p>
      <Link href="/">Voltar aos projetos</Link>
    </main>
  );
}
