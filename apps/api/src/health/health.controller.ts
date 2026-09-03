import { Controller, Get, Inject } from '@nestjs/common';

import { HealthService } from './health.service.js';
import type { HealthStatus } from './health.service.js';

@Controller('health')
export class HealthController {
  public constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Get()
  public check(): HealthStatus {
    return this.healthService.check();
  }
}
