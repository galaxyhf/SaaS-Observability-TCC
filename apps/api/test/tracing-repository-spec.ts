import { jest } from '@jest/globals';
import type { Prisma } from '@tcc-observability/database';
import type { PrismaService } from '../src/database/prisma.service.js';
import { TracingRepository } from '../src/tracing/tracing.repository.js';
import { TraceQueryDto } from '../src/tracing/trace-query.dto.js';

describe('Tracing SQL isolation and aggregation', () => {
  it('parameterizes values, filters participating services without duplicating traces and aggregates before pagination', async () => {
    const calls: Prisma.Sql[] = [];
    const db = {
      $queryRaw: jest.fn((sql: Prisma.Sql) => {
        calls.push(sql);
        return Promise.resolve([]);
      }),
      $transaction: jest.fn(async (queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    };
    const repository = new TracingRepository(db as unknown as PrismaService);
    const operation = "x%' OR 1=1 --";
    await repository.overview('owner', 'project', {
      ...new TraceQueryDto(),
      operation,
      serviceId: 'service',
      environmentId: 'environment',
      status: 'ERROR',
      minDurationMs: 50,
      page: 2,
    });
    expect(calls).toHaveLength(4);
    for (const query of calls) {
      expect(query.values).toEqual(
        expect.arrayContaining([
          'owner',
          'project',
          operation,
          'service',
          'environment',
          'ERROR',
          50,
        ]),
      );
      expect(query.text).not.toContain(operation);
      expect(query.text).toContain('p.user_id =');
      expect(query.text).toContain('EXISTS (SELECT 1 FROM spans');
    }
    expect(calls[0]!.text).toContain('LIMIT 50 OFFSET');
    expect(calls[1]!.text).not.toContain('LIMIT');
    expect(calls[1]!.text).toContain('percentile_cont(0.95)');
    expect(calls[1]!.text).toContain('count(*) FILTER');
  });
  it('scopes detail and service queries by owner as well as project', async () => {
    const db = {
      trace: { findFirst: jest.fn() },
      service: { findMany: jest.fn() },
    };
    const repository = new TracingRepository(db as unknown as PrismaService);
    await repository.detail('owner', 'project', 'trace');
    await repository.services('owner', 'project');
    expect(db.trace.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'project',
          traceId: 'trace',
          project: { userId: 'owner' },
        },
      }),
    );
    expect(db.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project', project: { userId: 'owner' } },
      }),
    );
  });
});
