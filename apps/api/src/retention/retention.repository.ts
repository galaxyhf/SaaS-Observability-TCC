import { Injectable } from '@nestjs/common';
import { Prisma } from '@tcc-observability/database';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class RetentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async deleteBatch(batchSize: number): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
        const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>(Prisma.sql`
        SELECT pg_try_advisory_xact_lock(731947, 7) AS acquired`);
        if (!lock?.acquired) return 0;
        const [result] = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`
        WITH expired AS (
          SELECT t.id FROM projects p
          JOIN traces t ON t.project_id = p.id
          WHERE t.started_at < CURRENT_TIMESTAMP - make_interval(days => p.retention_days)
            AND t.last_received_at < CURRENT_TIMESTAMP - interval '5 minutes'
          ORDER BY t.started_at, t.id
          LIMIT ${batchSize} FOR UPDATE OF t SKIP LOCKED
        ), deleted AS (
          DELETE FROM traces t USING expired e WHERE t.id = e.id RETURNING t.id
        ) SELECT count(*)::int AS count FROM deleted`);
        // Quota bookkeeping has its own bounded cleanup; never touches project credentials.
        await tx.$executeRaw`DELETE FROM ingestion_windows WHERE (project_id, window_started_at) IN (
        SELECT project_id, window_started_at FROM ingestion_windows
        WHERE window_started_at < CURRENT_TIMESTAMP - interval '1 day'
        ORDER BY window_started_at LIMIT ${batchSize}
      )`;
        return result?.count ?? 0;
      },
      { timeout: 10_000, maxWait: 5_000 },
    );
  }
}
