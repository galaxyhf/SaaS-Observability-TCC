import { delay } from '@/lib/delay';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  await delay(900);
  return Response.json({
    delayMs: 900,
    message: 'Atraso proposital concluído.',
    scenario: 'slow',
    timestamp: new Date().toISOString(),
  });
}
