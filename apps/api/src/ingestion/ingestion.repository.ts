import { Injectable } from '@nestjs/common';
import type { Prisma } from '@tcc-observability/database';

import { PrismaService } from '../database/prisma.service.js';
import type { NormalizedSpan, SafeJson } from './otlp.types.js';

const MAX_ENVIRONMENTS_PER_PROJECT = 20;
const MAX_SERVICES_PER_ENVIRONMENT = 200;

interface ResolvedSpan {
  serviceId: string;
  span: NormalizedSpan;
}

interface ServiceSpanGroup {
  firstSeenAt: Date;
  lastSeenAt: Date;
  spans: NormalizedSpan[];
}

function traceStatus(spans: NormalizedSpan[]): 'UNSET' | 'OK' | 'ERROR' {
  if (spans.some((span) => span.statusCode === 'ERROR')) return 'ERROR';
  if (spans.some((span) => span.statusCode === 'OK')) return 'OK';
  return 'UNSET';
}

function preserveHighestStatus(
  current: 'UNSET' | 'OK' | 'ERROR',
  incoming: 'UNSET' | 'OK' | 'ERROR',
): 'UNSET' | 'OK' | 'ERROR' {
  const rank = { ERROR: 2, OK: 1, UNSET: 0 } as const;
  return rank[incoming] > rank[current] ? incoming : current;
}

function json(value: SafeJson): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class IngestionRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async persist(
    projectId: string,
    spans: NormalizedSpan[],
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const resolved = await this.resolveServices(
          transaction,
          projectId,
          spans,
        );
        const traces = new Map<string, ResolvedSpan[]>();

        for (const item of resolved) {
          const current = traces.get(item.span.traceId) ?? [];
          current.push(item);
          traces.set(item.span.traceId, current);
        }

        for (const traceSpans of traces.values()) {
          await this.persistTrace(transaction, projectId, traceSpans);
        }
      },
      { isolationLevel: 'Serializable', timeout: 20_000 },
    );
  }

  private async resolveServices(
    transaction: Prisma.TransactionClient,
    projectId: string,
    spans: NormalizedSpan[],
  ): Promise<ResolvedSpan[]> {
    const environments = new Map<string, string>();
    const services = new Map<string, string>();
    const result: ResolvedSpan[] = [];
    const groups = new Map<string, ServiceSpanGroup>();

    for (const span of spans) {
      const key = `${span.environmentSlug}:${span.serviceName}`;
      const group = groups.get(key);
      if (group) {
        group.spans.push(span);
        if (span.startedAt < group.firstSeenAt)
          group.firstSeenAt = span.startedAt;
        if (span.endedAt > group.lastSeenAt) group.lastSeenAt = span.endedAt;
      } else {
        groups.set(key, {
          firstSeenAt: span.startedAt,
          lastSeenAt: span.endedAt,
          spans: [span],
        });
      }
    }

    for (const group of groups.values()) {
      const span = group.spans[0];
      if (!span) continue;
      let environmentId = environments.get(span.environmentSlug);
      if (!environmentId) {
        environmentId = await this.ensureEnvironment(
          transaction,
          projectId,
          span,
        );
        environments.set(span.environmentSlug, environmentId);
      }

      const serviceKey = `${environmentId}:${span.serviceName}`;
      let serviceId = services.get(serviceKey);
      if (!serviceId) {
        serviceId = await this.ensureService(
          transaction,
          projectId,
          environmentId,
          span,
          group.firstSeenAt,
          group.lastSeenAt,
        );
        services.set(serviceKey, serviceId);
      }
      result.push(
        ...group.spans.map((groupSpan) => ({ serviceId, span: groupSpan })),
      );
    }
    return result;
  }

  private async ensureEnvironment(
    transaction: Prisma.TransactionClient,
    projectId: string,
    span: NormalizedSpan,
  ): Promise<string> {
    const existing = await transaction.environment.findUnique({
      select: { id: true },
      where: {
        projectId_slug: { projectId, slug: span.environmentSlug },
      },
    });
    if (existing) return existing.id;

    const count = await transaction.environment.count({ where: { projectId } });
    if (count >= MAX_ENVIRONMENTS_PER_PROJECT) {
      throw new Error('Environment cardinality limit reached.');
    }
    const created = await transaction.environment.upsert({
      create: {
        name: span.environmentName,
        projectId,
        slug: span.environmentSlug,
      },
      update: {},
      select: { id: true },
      where: { projectId_slug: { projectId, slug: span.environmentSlug } },
    });
    return created.id;
  }

  private async ensureService(
    transaction: Prisma.TransactionClient,
    projectId: string,
    environmentId: string,
    span: NormalizedSpan,
    firstSeenAt: Date,
    lastSeenAt: Date,
  ): Promise<string> {
    const existing = await transaction.service.findUnique({
      where: {
        projectId_environmentId_name: {
          environmentId,
          name: span.serviceName,
          projectId,
        },
      },
    });
    if (existing) {
      const updated = await transaction.service.update({
        data: {
          firstSeenAt:
            firstSeenAt < existing.firstSeenAt
              ? firstSeenAt
              : existing.firstSeenAt,
          lastSeenAt:
            lastSeenAt > existing.lastSeenAt ? lastSeenAt : existing.lastSeenAt,
          type: existing.type === 'UNKNOWN' ? span.serviceType : existing.type,
        },
        select: { id: true },
        where: { id: existing.id },
      });
      return updated.id;
    }

    const count = await transaction.service.count({ where: { environmentId } });
    if (count >= MAX_SERVICES_PER_ENVIRONMENT) {
      throw new Error('Service cardinality limit reached.');
    }
    const created = await transaction.service.upsert({
      create: {
        environmentId,
        firstSeenAt,
        lastSeenAt,
        name: span.serviceName,
        projectId,
        type: span.serviceType,
      },
      update: {
        firstSeenAt,
        lastSeenAt,
      },
      select: { id: true },
      where: {
        projectId_environmentId_name: {
          environmentId,
          name: span.serviceName,
          projectId,
        },
      },
    });
    return created.id;
  }

  private async persistTrace(
    transaction: Prisma.TransactionClient,
    projectId: string,
    resolved: ResolvedSpan[],
  ): Promise<void> {
    const spans = resolved.map((item) => item.span);
    const traceId = spans[0]?.traceId;
    if (!traceId) return;

    const actualRoot = resolved.find((item) => item.span.parentSpanId === null);
    const root = actualRoot ?? resolved[0];
    if (!root) return;
    const startedAt = actualRoot
      ? actualRoot.span.startedAt
      : new Date(Math.min(...spans.map((span) => span.startedAt.getTime())));
    const endedAt = actualRoot
      ? actualRoot.span.endedAt
      : new Date(Math.max(...spans.map((span) => span.endedAt.getTime())));
    const existing = await transaction.trace.findUnique({
      where: { projectId_traceId: { projectId, traceId } },
    });
    const environment = await transaction.service.findUniqueOrThrow({
      select: { environmentId: true },
      where: { id: root.serviceId },
    });

    const trace = existing
      ? await transaction.trace.update({
          data: {
            durationMs: actualRoot
              ? actualRoot.span.durationMs
              : Math.max(existing.endedAt.getTime(), endedAt.getTime()) -
                Math.min(existing.startedAt.getTime(), startedAt.getTime()),
            endedAt: existing.endedAt > endedAt ? existing.endedAt : endedAt,
            environmentId: actualRoot
              ? environment.environmentId
              : existing.environmentId,
            lastReceivedAt: new Date(),
            rootSpanName: actualRoot ? root.span.name : existing.rootSpanName,
            serviceId: actualRoot ? root.serviceId : existing.serviceId,
            startedAt:
              existing.startedAt < startedAt ? existing.startedAt : startedAt,
            status: preserveHighestStatus(existing.status, traceStatus(spans)),
          },
          where: { id: existing.id },
        })
      : await transaction.trace.create({
          data: {
            durationMs: actualRoot
              ? actualRoot.span.durationMs
              : endedAt.getTime() - startedAt.getTime(),
            endedAt,
            environmentId: environment.environmentId,
            projectId,
            rootSpanName: root.span.name,
            serviceId: root.serviceId,
            startedAt,
            status: traceStatus(spans),
            traceId,
          },
        });

    await transaction.span.createMany({
      data: resolved.map(({ serviceId, span }) => ({
        attributes: json(span.attributes),
        durationMs: span.durationMs,
        endedAt: span.endedAt,
        events: json(span.events),
        flags: span.flags,
        kind: span.kind,
        links: json(span.links),
        name: span.name,
        parentSpanId: span.parentSpanId,
        resourceAttributes: json(span.resourceAttributes),
        scopeName: span.scopeName,
        scopeVersion: span.scopeVersion,
        serviceId,
        spanId: span.spanId,
        startedAt: span.startedAt,
        statusCode: span.statusCode,
        statusMessage: span.statusMessage,
        traceRecordId: trace.id,
        traceState: span.traceState,
      })),
      skipDuplicates: true,
    });
  }
}
