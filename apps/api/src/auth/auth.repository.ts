import { Injectable } from '@nestjs/common';
import type { AuthSession } from '@tcc-observability/database';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class AuthRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public createSession(data: {
    expiresAt: Date;
    id: string;
    refreshTokenHash: string;
    userId: string;
  }): Promise<AuthSession> {
    return this.prisma.authSession.create({ data });
  }

  public findActiveSession(
    id: string,
    userId: string,
  ): Promise<AuthSession | null> {
    return this.prisma.authSession.findFirst({
      where: {
        expiresAt: { gt: new Date() },
        id,
        revokedAt: null,
        userId,
      },
    });
  }

  public rotateSession(
    id: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AuthSession> {
    return this.prisma.authSession.update({
      data: { expiresAt, refreshTokenHash },
      where: { id },
    });
  }

  public revokeSession(id: string): Promise<AuthSession> {
    return this.prisma.authSession.update({
      data: { revokedAt: new Date() },
      where: { id },
    });
  }
}
