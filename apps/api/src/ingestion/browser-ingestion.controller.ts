import { loadSync, type ServiceDefinition } from '@grpc/proto-loader';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Injectable,
  Options,
  Param,
  Post,
  Res,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  HttpException,
} from '@nestjs/common';
import { GrpcResourceExhaustedException } from '@nestjs/microservices';
import type { Response } from 'express';
import { join } from 'node:path';
import { PrismaService } from '../database/prisma.service.js';
import { protoRoot } from './ingestion-grpc.options.js';
import { IngestionRepository } from './ingestion.repository.js';
import { OtlpMapper } from './otlp-mapper.js';
import type { ExportTraceServiceRequest } from './otlp.types.js';

const definitions = loadSync(
  join(
    protoRoot(),
    'opentelemetry/proto/collector/trace/v1/trace_service.proto',
  ),
  {
    includeDirs: [protoRoot()],
    longs: String,
    enums: Number,
  },
);
const service = definitions[
  'opentelemetry.proto.collector.trace.v1.TraceService'
] as ServiceDefinition;
const exportMethod = service['Export']!;

@Injectable()
export class BrowserOriginPolicy {
  public constructor(private readonly prisma: PrismaService) {}

  public async authorize(
    publicId: string,
    origin: string | undefined,
  ): Promise<string> {
    if (!origin || !/^obs_pub_[a-zA-Z0-9_-]{1,72}$/.test(publicId)) {
      throw new ForbiddenException('Origem ou projeto não permitido.');
    }
    const project = await this.prisma.project.findFirst({
      where: { publicId, allowedOrigins: { some: { origin } } },
      select: { id: true },
    });
    if (!project)
      throw new ForbiddenException('Origem ou projeto não permitido.');
    return project.id;
  }
}

@Controller('browser/:publicId/v1/traces')
export class BrowserIngestionController {
  public constructor(
    private readonly policy: BrowserOriginPolicy,
    private readonly mapper: OtlpMapper,
    private readonly repository: IngestionRepository,
  ) {}

  private cors(response: Response, origin: string): void {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Max-Age', '300');
  }

  @Options()
  @HttpCode(204)
  public async preflight(
    @Param('publicId') publicId: string,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.policy.authorize(publicId, origin);
    this.cors(response, origin!);
  }

  @Post()
  @HttpCode(200)
  public async ingest(
    @Param('publicId') publicId: string,
    @Headers('origin') origin: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    const projectId = await this.policy.authorize(publicId, origin);
    this.cors(response, origin!);
    if (contentType?.split(';')[0]?.trim() !== 'application/x-protobuf') {
      throw new UnsupportedMediaTypeException('Use OTLP protobuf.');
    }
    if (!Buffer.isBuffer(body) || body.length === 0)
      throw new BadRequestException('Payload OTLP inválido.');
    let request: ExportTraceServiceRequest;
    try {
      request = exportMethod.requestDeserialize(
        body,
      ) as ExportTraceServiceRequest;
    } catch {
      throw new BadRequestException('Payload OTLP inválido.');
    }
    const mapped = this.mapper.map(request);
    // A origem pública sempre representa um serviço browser, mesmo com atributos forjados.
    for (const span of mapped.spans) {
      span.serviceType = 'BROWSER';
      span.resourceAttributes['obs.service.type'] = 'browser';
    }
    try {
      await this.repository.persist(projectId, mapped.spans);
    } catch (error) {
      if (error instanceof GrpcResourceExhaustedException)
        throw new HttpException('Quota de ingestão excedida.', 429);
      throw new ServiceUnavailableException(
        'Ingestão temporariamente indisponível.',
      );
    }
    response.type('application/x-protobuf');
    return exportMethod.responseSerialize(
      mapped.rejectedSpans || mapped.warnings.length
        ? {
            partialSuccess: {
              rejectedSpans: String(mapped.rejectedSpans),
              errorMessage: mapped.warnings.join(' ').slice(0, 2048),
            },
          }
        : {},
    );
  }
}
