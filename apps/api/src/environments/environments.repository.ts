import { Injectable } from '@nestjs/common';
import type { Environment } from '@tcc-observability/database';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class EnvironmentsRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public list(projectId: string): Promise<Environment[]> {
    return this.prisma.environment.findMany({
      orderBy: { createdAt: 'asc' },
      where: { projectId },
    });
  }

  public slugExists(projectId: string, slug: string): Promise<boolean> {
    return this.prisma.environment
      .count({ where: { projectId, slug } })
      .then((count) => count > 0);
  }

  public create(data: {
    name: string;
    projectId: string;
    slug: string;
  }): Promise<Environment> {
    return this.prisma.environment.create({ data });
  }
}
