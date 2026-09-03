import { Injectable } from '@nestjs/common';
import type { Prisma, ProjectKey } from '@tcc-observability/database';

import { PrismaService } from '../database/prisma.service.js';

export type ProjectWithEnvironments = Prisma.ProjectGetPayload<{
  include: { environments: true };
}>;

@Injectable()
export class ProjectsRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public slugExists(userId: string, slug: string): Promise<boolean> {
    return this.prisma.project
      .count({ where: { slug, userId } })
      .then((count) => count > 0);
  }

  public createWithDefaults(input: {
    keyHash: string;
    keyPrefix: string;
    name: string;
    publicId: string;
    retentionDays: number;
    slug: string;
    userId: string;
    websiteUrl?: string;
  }): Promise<ProjectWithEnvironments> {
    return this.prisma.$transaction(async (transaction) => {
      return transaction.project.create({
        data: {
          name: input.name,
          publicId: input.publicId,
          retentionDays: input.retentionDays,
          slug: input.slug,
          userId: input.userId,
          websiteUrl: input.websiteUrl,
          environments: {
            create: { name: 'Production', slug: 'production' },
          },
          keys: {
            create: { keyHash: input.keyHash, prefix: input.keyPrefix },
          },
        },
        include: { environments: true },
      });
    });
  }

  public list(userId: string): Promise<ProjectWithEnvironments[]> {
    return this.prisma.project.findMany({
      include: { environments: true },
      orderBy: { createdAt: 'desc' },
      where: { userId },
    });
  }

  public findOwnedById(
    userId: string,
    projectId: string,
  ): Promise<ProjectWithEnvironments | null> {
    return this.prisma.project.findFirst({
      include: { environments: true },
      where: { id: projectId, userId },
    });
  }

  public createKey(data: {
    keyHash: string;
    prefix: string;
    projectId: string;
  }): Promise<ProjectKey> {
    return this.prisma.projectKey.create({ data });
  }

  public listKeys(projectId: string): Promise<ProjectKey[]> {
    return this.prisma.projectKey.findMany({
      orderBy: { createdAt: 'desc' },
      where: { projectId },
    });
  }

  public revokeKeySafely(
    projectId: string,
    keyId: string,
  ): Promise<'last-active' | 'not-found' | 'revoked'> {
    return this.prisma.$transaction(
      async (transaction) => {
        const key = await transaction.projectKey.findFirst({
          where: { id: keyId, projectId, revokedAt: null },
        });

        if (!key) {
          return 'not-found';
        }

        const activeKeyCount = await transaction.projectKey.count({
          where: { projectId, revokedAt: null },
        });

        if (activeKeyCount <= 1) {
          return 'last-active';
        }

        await transaction.projectKey.update({
          data: { revokedAt: new Date() },
          where: { id: keyId },
        });
        return 'revoked';
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
