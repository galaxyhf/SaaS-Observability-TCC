// Run only with an explicitly isolated Neon branch. Never part of the default unit suite.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/database/prisma.service.js';
import { RetentionRepository } from '../src/retention/retention.repository.js';
import { IngestionRepository } from '../src/ingestion/ingestion.repository.js';
import { TracingRepository } from '../src/tracing/tracing.repository.js';
import { TraceQueryDto } from '../src/tracing/trace-query.dto.js';
import type { NormalizedSpan } from '../src/ingestion/otlp.types.js';

const url = process.env.OPERATIONAL_TEST_DATABASE_URL;
assert(
  url && process.env.OPERATIONAL_TEST_CONFIRM_ISOLATED === 'true',
  'Requires OPERATIONAL_TEST_DATABASE_URL and OPERATIONAL_TEST_CONFIRM_ISOLATED=true; uses deletes.',
);
const config = new ConfigService({
  DATABASE_URL: url,
  INGESTION_SPANS_PER_MINUTE: 10000,
});
const db = new PrismaService(config);
const ids: string[] = [];
const past = (days: number) => new Date(Date.now() - days * 86400000);
const normalized = (
  traceId: string,
  spanId = 'a'.repeat(16),
): NormalizedSpan => ({
  traceId,
  spanId,
  parentSpanId: null,
  serviceName: 'integration-server',
  serviceType: 'SERVER',
  environmentName: 'Teste',
  environmentSlug: 'test',
  name: 'order.process',
  kind: 'INTERNAL',
  startedAt: new Date(Date.now() - 1000),
  endedAt: new Date(),
  durationMs: '1000',
  statusCode: 'OK',
  statusMessage: null,
  attributes: {},
  resourceAttributes: {},
  events: [],
  links: [],
  flags: 1,
  scopeName: null,
  scopeVersion: null,
  traceState: null,
});
try {
  const user = await db.user.create({
    data: {
      name: 'Operational integration',
      email: `${randomUUID()}@integration.test`,
      passwordHash: 'integration-only',
    },
  });
  ids.push(user.id);
  const projects = await Promise.all(
    [7, 30, 7, 7].map((retentionDays, i) =>
      db.project.create({
        data: {
          userId: user.id,
          name: `Test ${i}`,
          slug: randomUUID(),
          publicId: randomUUID(),
          retentionDays,
        },
      }),
    ),
  );
  const [short, long, quota, capacity] = projects;
  assert(short && long && quota && capacity);
  const ingestion = new IngestionRepository(db, config);
  await ingestion.persist(short.id, [normalized('a'.repeat(32))]);
  await ingestion.persist(long.id, [normalized('b'.repeat(32))]);
  await ingestion.persist(short.id, [normalized('c'.repeat(32))]);
  await db.trace.updateMany({
    where: { projectId: { in: [short.id, long.id] } },
    data: { startedAt: past(10), endedAt: past(10) },
  });
  await db.trace.updateMany({
    where: {
      traceId: { in: ['a'.repeat(32), 'b'.repeat(32)] },
      projectId: { in: [short.id, long.id] },
    },
    data: { lastReceivedAt: past(10) },
  });
  const retention = new RetentionRepository(db);
  await retention.deleteBatch(1000);
  assert.equal(
    await db.trace.count({
      where: { projectId: short.id, traceId: 'a'.repeat(32) },
    }),
    0,
  );
  assert.equal(await db.trace.count({ where: { projectId: long.id } }), 1);
  assert.equal(
    await db.trace.count({
      where: { projectId: short.id, traceId: 'c'.repeat(32) },
    }),
    1,
  );
  assert.equal(
    await db.span.count({ where: { trace: { projectId: short.id } } }),
    1,
  );
  console.log(
    'PASS retention: per-project policy, grace period and cascading span deletion',
  );
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731947, 7)::text`;
    assert.equal(await retention.deleteBatch(100), 0);
  });
  console.log('PASS retention: concurrent worker lock');
  const low = new IngestionRepository(
    db,
    new ConfigService({ INGESTION_SPANS_PER_MINUTE: 2 }),
  );
  await low.persist(quota.id, [normalized('d'.repeat(32))]);
  await low.persist(quota.id, [normalized('d'.repeat(32))]);
  await assert.rejects(
    low.persist(quota.id, [normalized('e'.repeat(32))]),
    /quota exceeded/,
  );
  assert.equal(
    await db.span.count({ where: { trace: { projectId: quota.id } } }),
    1,
  );
  await low.persist(long.id, [normalized('f'.repeat(32))]);
  console.log(
    'PASS ingestion: shared quota, retries remain idempotent, project isolation',
  );
  // Move the exhausted counter into a past minute and verify a new window can accept spans.
  await db.ingestionWindow.updateMany({
    where: { projectId: quota.id },
    data: { windowStartedAt: new Date(Date.now() - 120000) },
  });
  await low.persist(quota.id, [normalized('e'.repeat(32))]);
  console.log('PASS ingestion: quota window renewal');
  const parallel = await Promise.allSettled([
    low.persist(quota.id, [normalized('2'.repeat(32))]),
    low.persist(quota.id, [normalized('3'.repeat(32))]),
  ]);
  assert.equal(
    parallel.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    parallel.filter((result) => result.status === 'rejected').length,
    1,
  );
  console.log(
    'PASS ingestion: concurrent exports cannot overspend the project quota',
  );

  const spans = Array.from({ length: 2000 }, (_, i) =>
    normalized('1'.repeat(32), i.toString(16).padStart(16, '0')),
  );
  await ingestion.persist(capacity.id, spans);
  await ingestion.persist(capacity.id, [spans[0]!]);
  await assert.rejects(
    ingestion.persist(capacity.id, [
      normalized('1'.repeat(32), 'f'.repeat(16)),
    ]),
    /span limit/,
  );
  assert.equal(
    await db.span.count({ where: { trace: { projectId: capacity.id } } }),
    2000,
  );
  console.log('PASS ingestion: 2000-span cap across exports, duplicate-safe');
  const tracing = new TracingRepository(db);
  const overview = await tracing.overview(
    user.id,
    capacity.id,
    new TraceQueryDto(),
  );
  assert.equal(overview.summary?.total, 1);
  assert.equal(overview.summary?.p50, 1000);
  const other = await tracing.overview(
    randomUUID(),
    capacity.id,
    new TraceQueryDto(),
  );
  assert.equal(other.summary?.total, 0);
  console.log('PASS tracing: actual PostgreSQL percentiles and ownership');
  const original = await db.trace.findFirstOrThrow({
    where: { projectId: capacity.id },
  });
  await db.trace.createMany({
    data: Array.from({ length: 5000 }, (_, i) => ({
      projectId: capacity.id,
      environmentId: original.environmentId,
      traceId: (1000 + i).toString(16).padStart(32, '0'),
      startedAt: new Date(Date.now() - i * 20000),
      endedAt: new Date(Date.now() - i * 20000 + 100),
      durationMs: 100,
      status: 'OK' as const,
    })),
  });
  await db.$executeRaw`ANALYZE traces`;
  const plan = await db.$queryRaw<
    { 'QUERY PLAN': string }[]
  >`EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM traces WHERE project_id = ${capacity.id}::uuid AND started_at >= CURRENT_TIMESTAMP - interval '1 day' ORDER BY started_at DESC, id DESC LIMIT 50`;
  console.log('PLAN', plan.map((row) => row['QUERY PLAN']).join('\n'));
} finally {
  // These are only the synthetic users created above, never inherited users.
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}
