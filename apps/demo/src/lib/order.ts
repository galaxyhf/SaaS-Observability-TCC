import { traceOperation } from '@tcc-observability/node/trace-operation';

import { delay } from './delay';
import { insertOrder } from './database';

export interface OrderResult {
  orderId: string;
  quantity: number;
  status: 'confirmed';
  totalCents: number;
}

export async function processOrder(quantity: number): Promise<OrderResult> {
  return traceOperation(
    'processOrder',
    async () => {
      await traceOperation('validateOrder', async () => {
        await delay(25);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
          throw new Error('A quantidade deve ser um inteiro entre 1 e 10.');
        }
      });

      await traceOperation('checkInventory', async () => {
        await delay(120);
      });

      const totalCents = quantity * 4_990;
      await traceOperation(
        'authorizePayment',
        async () => {
          await delay(320);
        },
        { attributes: { 'order.total_cents': totalCents } },
      );

      const orderId = await traceOperation('persistOrder', () =>
        insertOrder({ quantity, totalCents }),
      );

      return { orderId, quantity, status: 'confirmed', totalCents };
    },
    { attributes: { 'order.quantity': quantity } },
  );
}
