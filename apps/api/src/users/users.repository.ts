import { Injectable } from '@nestjs/common';
import type { User } from '@tcc-observability/database';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class UsersRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  public findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  public create(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
