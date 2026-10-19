import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
    return this.prisma.$transaction(
      async (tx) => {
        const count = await tx.environment.count({
          where: { projectId: data.projectId },
        });
        if (count >= 20)
          throw new HttpException(
            'Este projeto atingiu o limite de 20 ambientes.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        return tx.environment.create({ data });
      },
      { isolationLevel: 'Serializable', timeout: 10000 },
    );
  }
}
