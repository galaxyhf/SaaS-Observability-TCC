import { traceOperation } from '@tcc-observability/node/trace-operation';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await traceOperation('generateDemoError', () => {
      throw new Error('Erro proposital da aplicação demonstrativa.');
    });
    return Response.json({ scenario: 'error' });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Erro demonstrativo.',
        scenario: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
