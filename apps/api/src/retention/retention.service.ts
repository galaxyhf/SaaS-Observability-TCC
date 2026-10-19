import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetentionRepository } from './retention.repository.js';

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;
  private stopping = false;
  constructor(
    private readonly config: ConfigService,
    private readonly repository: RetentionRepository,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    const interval =
      this.config.getOrThrow<number>('RETENTION_INTERVAL_SECONDS') * 1000;
    // The first run is delayed as well: startup never waits for a destructive job.
    this.timer = setInterval(() => {
      void this.run();
    }, interval);
    this.timer.unref();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  run(): Promise<number> {
    if (this.stopping) return Promise.resolve(0);
    if (this.running) return this.running;
    this.running = this.cleanup().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async cleanup(): Promise<number> {
    let deleted = 0;
    const deadline = Date.now() + 30000;
    try {
      const size = this.config.getOrThrow<number>('RETENTION_BATCH_SIZE');
      const batches = this.config.getOrThrow<number>('RETENTION_MAX_BATCHES');
      for (
        let i = 0;
        i < batches && !this.stopping && Date.now() < deadline;
        i++
      ) {
        const count = await this.repository.deleteBatch(size);
        deleted += count;
        if (count < size) break;
      }
      if (deleted) this.logger.log({ event: 'retention.completed', deleted });
    } catch {
      // Driver errors can include connection details. Log only a safe operational event.
      this.logger.error({
        event: 'retention.failed',
        deleted,
        retry: 'next scheduled run',
      });
    }
    return deleted;
  }
}
