import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@tcc-observability/database';
import type { PrismaService } from '../src/database/prisma.service.js';
import { RetentionRepository } from '../src/retention/retention.repository.js';
import { RetentionService } from '../src/retention/retention.service.js';

const config = new ConfigService({
  NODE_ENV: 'test',
  RETENTION_BATCH_SIZE: 2,
  RETENTION_MAX_BATCHES: 3,
});
describe('Retention worker', () => {
  it('schedules bounded cleanup after the interval and stops on shutdown', async () => {
    jest.useFakeTimers();
    const repository = {
      deleteBatch: jest.fn<() => Promise<number>>().mockResolvedValue(0),
    };
    const worker = new RetentionService(
      new ConfigService({
        NODE_ENV: 'development',
        RETENTION_INTERVAL_SECONDS: 60,
        RETENTION_BATCH_SIZE: 10,
        RETENTION_MAX_BATCHES: 1,
      }),
      repository as unknown as RetentionRepository,
    );
    try {
      worker.onModuleInit();
      expect(repository.deleteBatch).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(60000);
      expect(repository.deleteBatch).toHaveBeenCalledTimes(1);
      await worker.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(60000);
      expect(repository.deleteBatch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops at the configured bound and does not overlap runs', async () => {
    const repository = {
      deleteBatch: jest.fn<() => Promise<number>>().mockResolvedValue(2),
    };
    const worker = new RetentionService(
      config,
      repository as unknown as RetentionRepository,
    );
    const first = worker.run();
    expect(worker.run()).toBe(first);
    expect(await first).toBe(6);
    expect(repository.deleteBatch).toHaveBeenCalledTimes(3);
  });
  it('stops after a partial batch and can run again after a failure', async () => {
    const repository = {
      deleteBatch: jest
        .fn<() => Promise<number>>()
        .mockRejectedValueOnce(new Error('private connection information'))
        .mockResolvedValueOnce(1),
    };
    const worker = new RetentionService(
      config,
      repository as unknown as RetentionRepository,
    );
    expect(await worker.run()).toBe(0);
    expect(await worker.run()).toBe(1);
    await worker.onModuleDestroy();
    expect(await worker.run()).toBe(0);
    expect(repository.deleteBatch).toHaveBeenCalledTimes(2);
  });
  it('uses project-specific age, grace period, locked batches and a transaction-scoped lock', async () => {
    const calls: Prisma.Sql[] = [];
    const tx = {
      $executeRaw: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      $queryRaw: jest.fn((sql: Prisma.Sql) => {
        calls.push(sql);
        return Promise.resolve(
          calls.length === 1 ? [{ acquired: true }] : [{ count: 2 }],
        );
      }),
    };
    const prisma = {
      $transaction: async (fn: (db: typeof tx) => Promise<number>) => fn(tx),
    };
    expect(
      await new RetentionRepository(
        prisma as unknown as PrismaService,
      ).deleteBatch(2),
    ).toBe(2);
    expect(calls[0]!.text).toContain('pg_try_advisory_xact_lock');
    expect(calls[1]!.text).toContain('make_interval(days => p.retention_days)');
    expect(calls[1]!.text).toContain('last_received_at');
    expect(calls[1]!.text).toContain('FOR UPDATE OF t SKIP LOCKED');
    expect(calls[1]!.values).toContain(2);
  });
  it('skips work when another instance holds the lock', async () => {
    const tx = {
      $executeRaw: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      $queryRaw: jest
        .fn<() => Promise<unknown[]>>()
        .mockResolvedValue([{ acquired: false }]),
    };
    const prisma = {
      $transaction: async (fn: (db: typeof tx) => Promise<number>) => fn(tx),
    };
    expect(
      await new RetentionRepository(
        prisma as unknown as PrismaService,
      ).deleteBatch(100),
    ).toBe(0);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
