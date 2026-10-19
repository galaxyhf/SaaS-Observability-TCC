import { Activity } from 'lucide-react';
import { LoginForm } from '../../components/account';
export default function LoginPage() {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <p className="brand">
          <span className="brand-mark">
            <Activity size={21} aria-hidden="true" />
          </span>
          <span>
            Observa<small>Seu app, por dentro.</small>
          </span>
        </p>
        <div className="auth-story-content">
          <h2>
            Entenda o que acontece.
            <br />
            Encontre o que importa.
          </h2>
          <p>
            Do primeiro sinal de lentidão à etapa que falhou, acompanhe o
            caminho de cada atividade da sua aplicação.
          </p>
        </div>
        <p className="auth-story-footer">
          Plataforma de observabilidade · Projeto de TCC
        </p>
      </section>
      <section className="auth">
        <h1>Bom ter você por aqui.</h1>
        <p className="muted">Entre para acompanhar suas aplicações.</p>
        <LoginForm />
      </section>
    </main>
  );
}
