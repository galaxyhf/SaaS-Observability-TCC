import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, PrismaPg } from '@tcc-observability/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  public constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
