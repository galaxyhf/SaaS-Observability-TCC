import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

interface DemoDatabaseGlobal {
  demoPool?: Pool;
  demoSchema?: Promise<void>;
}

const databaseGlobal = globalThis as typeof globalThis & DemoDatabaseGlobal;

function connectionString(): string {
  const value = process.env.DEMO_DATABASE_URL;
  if (!value) {
    throw new Error('DEMO_DATABASE_URL não foi configurada.');
  }
  return value;
}

export function databasePool(): Pool {
  databaseGlobal.demoPool ??= new Pool({
    allowExitOnIdle: true,
    connectionString: connectionString(),
    max: 5,
  });
  return databaseGlobal.demoPool;
}

async function ensureSchema(): Promise<void> {
  databaseGlobal.demoSchema ??= databasePool()
    .query(
      `
      CREATE TABLE IF NOT EXISTS demo_orders (
        id uuid PRIMARY KEY,
        quantity integer NOT NULL CHECK (quantity > 0),
        total_cents integer NOT NULL CHECK (total_cents >= 0),
        status varchar(32) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `,
    )
    .then(() => undefined);
  await databaseGlobal.demoSchema;
}

export async function databaseSummary(): Promise<{
  databaseTime: string;
  orderCount: number;
}> {
  await ensureSchema();
  const result = await databasePool().query<{
    database_time: Date;
    order_count: number;
  }>(
    'SELECT now() AS database_time, COUNT(*)::int AS order_count FROM demo_orders',
  );
  const row = result.rows[0];
  if (!row) throw new Error('O PostgreSQL não retornou o resumo esperado.');
  return {
    databaseTime: row.database_time.toISOString(),
    orderCount: row.order_count,
  };
}

export async function insertOrder(input: {
  quantity: number;
  totalCents: number;
}): Promise<string> {
  await ensureSchema();
  const id = randomUUID();
  await databasePool().query(
    `INSERT INTO demo_orders (id, quantity, total_cents, status)
     VALUES ($1, $2, $3, $4)`,
    [id, input.quantity, input.totalCents, 'confirmed'],
  );
  return id;
}
