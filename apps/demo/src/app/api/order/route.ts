import { processOrder } from '@/lib/order';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let quantity = 2;
  try {
    const body = (await request.json()) as { quantity?: unknown };
    if (typeof body.quantity === 'number') quantity = body.quantity;
  } catch {
    // O cenário aceita body vazio e usa uma quantidade segura por padrão.
  }

  try {
    const order = await processOrder(quantity);
    return Response.json({
      message: 'Pedido processado com múltiplos spans.',
      order,
      scenario: 'order',
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Pedido inválido.',
        scenario: 'order',
      },
      { status: 400 },
    );
  }
}
