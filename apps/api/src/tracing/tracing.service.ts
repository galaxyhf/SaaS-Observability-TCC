import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service.js';
import { TraceQueryDto } from './trace-query.dto.js';
import { TracingRepository } from './tracing.repository.js';

@Injectable()
export class TracingService {
  public constructor(
    private readonly projects: ProjectsService,
    private readonly repository: TracingRepository,
  ) {}
  public async overview(
    userId: string,
    projectId: string,
    query: TraceQueryDto,
  ) {
    await this.projects.requireOwnedProject(userId, projectId);
    return this.repository.overview(userId, projectId, query);
  }
  public async services(userId: string, projectId: string) {
    await this.projects.requireOwnedProject(userId, projectId);
    return this.repository.services(userId, projectId);
  }
  public async detail(userId: string, projectId: string, traceId: string) {
    await this.projects.requireOwnedProject(userId, projectId);
    const trace = await this.repository.detail(userId, projectId, traceId);
    if (!trace) throw new NotFoundException('Trace não encontrado.');
    return {
      ...trace,
      durationMs: Number(trace.durationMs),
      truncated: trace._count.spans > trace.spans.length,
      spans: trace.spans.map((span) => ({
        ...span,
        durationMs: Number(span.durationMs),
      })),
    };
  }
}
