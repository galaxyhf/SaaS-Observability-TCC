import { Controller } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';

import { IngestionService } from './ingestion.service.js';
import type {
  ExportTraceServiceRequest,
  ExportTraceServiceResponse,
} from './otlp.types.js';

const PROJECT_KEY_HEADER = 'x-obs-project-key';

@Controller()
export class IngestionController {
  public constructor(private readonly ingestionService: IngestionService) {}

  @GrpcMethod('TraceService', 'Export')
  public export(
    request: ExportTraceServiceRequest,
    metadata: Metadata,
  ): Promise<ExportTraceServiceResponse> {
    const value = metadata.get(PROJECT_KEY_HEADER)[0];
    const projectKey = typeof value === 'string' ? value : undefined;
    return this.ingestionService.ingest(projectKey, request);
  }
}
