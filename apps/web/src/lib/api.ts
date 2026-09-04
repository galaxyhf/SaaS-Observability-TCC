import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';

export async function api<T>(path: string): Promise<T> {
  const token = (await cookies()).get('obs_access');
  if (!token) redirect('/login');
  const response = await fetch(
    `${process.env.API_URL || 'http://localhost:4000'}/api${path}`,
    {
      headers: { Cookie: `obs_access=${token.value}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 401) redirect('/login?expired=1');
  if (response.status === 404) notFound();
  if (!response.ok)
    throw new Error(
      'Não foi possível consultar a API. Verifique os filtros e tente novamente.',
    );
  return response.json() as Promise<T>;
}
