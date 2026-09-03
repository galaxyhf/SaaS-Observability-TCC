import { databaseSummary } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const summary = await databaseSummary();
  return Response.json({
    message: 'Consulta executada no PostgreSQL.',
    scenario: 'database',
    ...summary,
  });
}
