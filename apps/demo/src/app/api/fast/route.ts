export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({
    message: 'Resposta concluída sem atraso proposital.',
    scenario: 'fast',
    timestamp: new Date().toISOString(),
  });
}
