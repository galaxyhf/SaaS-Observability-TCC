import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class IngestionAuthRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public findActiveKey(keyHash: string): Promise<{
    keyId: string;
    projectId: string;
  } | null> {
    return this.prisma.projectKey
      .findFirst({
        select: { id: true, projectId: true },
        where: { keyHash, revokedAt: null },
      })
      .then((key) =>
        key ? { keyId: key.id, projectId: key.projectId } : null,
      );
  }

  public async markUsed(keyId: string): Promise<void> {
    await this.prisma.projectKey.update({
      data: { lastUsedAt: new Date() },
      where: { id: keyId },
    });
  }
}
