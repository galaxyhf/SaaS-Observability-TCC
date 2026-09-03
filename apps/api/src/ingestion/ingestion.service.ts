import { Injectable } from '@nestjs/common';

import { IngestionAuthRepository } from './ingestion-auth.repository.js';
import { IngestionAuthService } from './ingestion-auth.service.js';
import { IngestionRepository } from './ingestion.repository.js';
import { OtlpMapper } from './otlp-mapper.js';
import type {
  ExportTraceServiceRequest,
  ExportTraceServiceResponse,
} from './otlp.types.js';

@Injectable()
export class IngestionService {
  public constructor(
    private readonly authService: IngestionAuthService,
    private readonly authRepository: IngestionAuthRepository,
    private readonly mapper: OtlpMapper,
    private readonly repository: IngestionRepository,
  ) {}

  public async ingest(
    projectKey: string | undefined,
    request: ExportTraceServiceRequest,
  ): Promise<ExportTraceServiceResponse> {
    const identity = await this.authService.authenticate(projectKey);
    const mapped = this.mapper.map(request);

    if (mapped.spans.length > 0) {
      await this.repository.persist(identity.projectId, mapped.spans);
      await this.authRepository.markUsed(identity.keyId);
    }

    if (mapped.rejectedSpans === 0 && mapped.warnings.length === 0) {
      return {};
    }
    return {
      partialSuccess: {
        errorMessage: mapped.warnings.join(' ').slice(0, 2_048),
        rejectedSpans: String(mapped.rejectedSpans),
      },
    };
  }
}
