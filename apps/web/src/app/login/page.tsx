import { LoginForm } from '../../components/account';
export default function LoginPage() {
  return (
    <main className="auth panel">
      <p className="brand">TCC Observability</p>
      <h1>Acompanhe sua aplicação.</h1>
      <p className="muted">
        Entre para investigar latência, erros e traces dos seus projetos.
      </p>
      <LoginForm />
    </main>
  );
}
