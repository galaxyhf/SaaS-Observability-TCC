'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

async function post(path: string, body: unknown = {}) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data =
    response.status === 204
      ? {}
      : await response.json().catch(() => ({
          message: 'Resposta indisponível. Tente novamente.',
        }));
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(' ')
        : data.message || 'Não foi possível concluir.',
    );
  return data;
}

export function LoginForm() {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const fields = new FormData(event.currentTarget);
    try {
      await post(
        `auth/${register ? 'register' : 'login'}`,
        Object.fromEntries(fields),
      );
      router.replace('/');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha de conexão.');
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      await post('auth/refresh');
      router.replace('/');
      router.refresh();
    } catch {
      setError('A sessão não pode ser renovada. Entre com e-mail e senha.');
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={submit} className="stack">
        {register && (
          <label>
            Nome
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
            />
          </label>
        )}
        <label>
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="username"
            maxLength={320}
            required
          />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 9 : 1}
            maxLength={128}
            required
          />
        </label>
        {register && <p className="muted">Use pelo menos 9 caracteres.</p>}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
      <div className="actions">
        <button
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register ? 'Já tenho conta' : 'Criar uma conta'}
        </button>
        <button disabled={busy} onClick={refresh}>
          Renovar sessão
        </button>
      </div>
    </>
  );
}

export function Logout() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post('auth/logout');
            router.replace('/login');
            router.refresh();
          } catch {
            setError('Não foi possível sair. Tente novamente.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saindo…' : 'Sair'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function CreateProject() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{
    id: string;
    projectKey: string;
  } | null>(null);
  return created ? (
    <section className="panel stack">
      <h2>Projeto criado</h2>
      <p>
        Guarde a Project Key no ambiente do servidor instrumentado. Ela será
        exibida somente agora.
      </p>
      <code className="secret">{created.projectKey}</code>
      <Link className="button primary" href={`/?project=${created.id}`}>
        Chave salva, abrir projeto
      </Link>
    </section>
  ) : (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        const name = new FormData(event.currentTarget).get('name');
        try {
          setCreated(await post('projects', { name }));
        } catch (error) {
          setError(
            error instanceof Error ? error.message : 'Falha de conexão.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Nome do projeto
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Minha aplicação"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Criando…' : 'Criar projeto'}
      </button>
    </form>
  );
}
