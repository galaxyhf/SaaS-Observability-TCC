import { Injectable } from '@nestjs/common';
import { Prisma } from '@tcc-observability/database';
import { PrismaService } from '../database/prisma.service.js';
import { queryPeriod, type TraceQueryDto } from './trace-query.dto.js';

@Injectable()
export class TracingRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async overview(
    userId: string,
    projectId: string,
    query: TraceQueryDto,
  ) {
    const { from, to } = queryPeriod(query);
    const conditions = [
      Prisma.sql`t.project_id = ${projectId}::uuid`,
      Prisma.sql`p.user_id = ${userId}::uuid`,
      Prisma.sql`t.started_at >= ${from} AND t.started_at < ${to}`,
    ];
    if (query.environmentId)
      conditions.push(
        Prisma.sql`t.environment_id = ${query.environmentId}::uuid`,
      );
    if (query.serviceId)
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM spans s WHERE s.trace_record_id = t.id AND s.service_id = ${query.serviceId}::uuid)`,
      );
    if (query.status)
      conditions.push(Prisma.sql`t.status::text = ${query.status}`);
    if (query.operation)
      conditions.push(
        Prisma.sql`strpos(lower(COALESCE(t.root_span_name, '')), lower(${query.operation})) > 0`,
      );
    if (query.minDurationMs !== undefined)
      conditions.push(Prisma.sql`t.duration_ms >= ${query.minDurationMs}`);
    const base = Prisma.sql`FROM traces t JOIN projects p ON p.id = t.project_id WHERE ${Prisma.join(conditions, ' AND ')}`;
    const order =
      query.sort === 'slowest'
        ? Prisma.sql`t.duration_ms DESC, t.started_at DESC, t.id DESC`
        : Prisma.sql`t.started_at DESC, t.id DESC`;
    const [items, summary, operations, series] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw(
          Prisma.sql`SELECT t.trace_id AS "traceId", t.root_span_name AS "rootSpanName", t.started_at AS "startedAt", t.duration_ms::float8 AS "durationMs", t.status, (SELECT name FROM services WHERE id = t.service_id) AS "serviceName", (SELECT name FROM environments WHERE id = t.environment_id) AS "environmentName" ${base} ORDER BY ${order} LIMIT 50 OFFSET ${(query.page - 1) * 50}`,
        ),
        this.prisma.$queryRaw<
          Array<{
            total: number;
            errors: number;
            p50: number | null;
            p95: number | null;
            p99: number | null;
          }>
        >(
          Prisma.sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE t.status = 'ERROR')::int AS errors, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.duration_ms::float8) AS p50, percentile_cont(0.95) WITHIN GROUP (ORDER BY t.duration_ms::float8) AS p95, percentile_cont(0.99) WITHIN GROUP (ORDER BY t.duration_ms::float8) AS p99 ${base}`,
        ),
        this.prisma.$queryRaw(
          Prisma.sql`SELECT COALESCE(t.root_span_name, '(raiz não recebida)') AS name, count(*)::int AS total, count(*) FILTER (WHERE t.status = 'ERROR')::int AS errors, percentile_cont(0.95) WITHIN GROUP (ORDER BY t.duration_ms::float8) AS p95 ${base} GROUP BY t.root_span_name ORDER BY p95 DESC, name LIMIT 20`,
        ),
        this.prisma.$queryRaw(
          Prisma.sql`SELECT floor(extract(epoch FROM (t.started_at - ${from}::timestamptz)) / ${Math.max(1, (to.getTime() - from.getTime()) / 1000 / 24)})::int AS bucket, count(*)::int AS total, count(*) FILTER (WHERE t.status = 'ERROR')::int AS errors ${base} GROUP BY bucket ORDER BY bucket`,
        ),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      items,
      summary: summary[0],
      operations,
      series,
      page: query.page,
      pageSize: 50,
      from,
      to,
    };
  }

  public services(userId: string, projectId: string) {
    return this.prisma.service.findMany({
      where: { projectId, project: { userId } },
      select: { id: true, name: true, environmentId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 4000,
    });
  }

  public detail(userId: string, projectId: string, traceId: string) {
    return this.prisma.trace.findFirst({
      where: { projectId, traceId, project: { userId } },
      include: {
        environment: { select: { name: true } },
        _count: { select: { spans: true } },
        spans: {
          take: 2000,
          orderBy: [{ startedAt: 'asc' }, { spanId: 'asc' }],
          include: { service: { select: { name: true } } },
        },
      },
    });
  }
}
