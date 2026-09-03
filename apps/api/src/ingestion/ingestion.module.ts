import { Module } from '@nestjs/common';

import { IngestionAuthRepository } from './ingestion-auth.repository.js';
import { IngestionAuthService } from './ingestion-auth.service.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionRepository } from './ingestion.repository.js';
import { IngestionService } from './ingestion.service.js';
import { OtlpMapper } from './otlp-mapper.js';
import { TelemetrySanitizer } from './telemetry-sanitizer.js';

@Module({
  controllers: [IngestionController],
  providers: [
    IngestionAuthRepository,
    IngestionAuthService,
    IngestionRepository,
    IngestionService,
    OtlpMapper,
    TelemetrySanitizer,
  ],
})
export class IngestionModule {}
