import { GET as getFast } from '../src/app/api/fast/route';
import { GET as getHealth } from '../src/app/api/health/route';
import { processOrder } from '../src/lib/order';

describe('aplicação demonstrativa', () => {
  it('responde ao cenário rápido sem depender do banco', async () => {
    const response = await getFast();
    const body = (await response.json()) as { scenario: string };

    expect(response.status).toBe(200);
    expect(body.scenario).toBe('fast');
  });

  it('expõe um health check estável', async () => {
    const response = await getHealth();
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('rejeita pedidos com quantidade inválida antes da persistência', async () => {
    await expect(processOrder(0)).rejects.toThrow(
      'A quantidade deve ser um inteiro entre 1 e 10.',
    );
  });
});
