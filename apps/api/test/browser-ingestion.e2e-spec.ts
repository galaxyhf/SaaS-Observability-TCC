import type { INestApplication } from '@nestjs/common';
import { GrpcResourceExhaustedException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { loadSync, type ServiceDefinition } from '@grpc/proto-loader';
import { jest } from '@jest/globals';
import request from 'supertest';
import { join } from 'node:path';
import { configureApp } from '../src/app.config.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  BrowserIngestionController,
  BrowserOriginPolicy,
} from '../src/ingestion/browser-ingestion.controller.js';
import { protoRoot } from '../src/ingestion/ingestion-grpc.options.js';
import { IngestionRepository } from '../src/ingestion/ingestion.repository.js';
import { OtlpMapper } from '../src/ingestion/otlp-mapper.js';
import { TelemetrySanitizer } from '../src/ingestion/telemetry-sanitizer.js';
import type { NormalizedSpan } from '../src/ingestion/otlp.types.js';

const definitions = loadSync(
  join(
    protoRoot(),
    'opentelemetry/proto/collector/trace/v1/trace_service.proto',
  ),
  { includeDirs: [protoRoot()], longs: String, enums: Number },
);
const method = (
  definitions[
    'opentelemetry.proto.collector.trace.v1.TraceService'
  ] as ServiceDefinition
)['Export']!;
const traceId = Buffer.from('1'.repeat(32), 'hex');
const parentSpanId = Buffer.from('2'.repeat(16), 'hex');
const payload = method.requestSerialize({
  resourceSpans: [
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'demo-browser' } },
          { key: 'obs.service.type', value: { stringValue: 'server' } },
        ],
      },
      scopeSpans: [
        {
          spans: [
            {
              traceId,
              spanId: Buffer.from('3'.repeat(16), 'hex'),
              parentSpanId,
              name: 'HTTP request',
              kind: 3,
              startTimeUnixNano: '1792400000000000000',
              endTimeUnixNano: '1792400000100000000',
              attributes: [
                { key: 'authorization', value: { stringValue: 'secret' } },
              ],
            },
          ],
        },
      ],
    },
  ],
});

describe('OTLP público browser', () => {
  let app: INestApplication;
  const findFirst =
    jest.fn<(input: unknown) => Promise<{ id: string } | null>>();
  const persist =
    jest.fn<(id: string, spans: NormalizedSpan[]) => Promise<void>>();
  const path = '/api/browser/obs_pub_demo/v1/traces';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BrowserIngestionController],
      providers: [
        BrowserOriginPolicy,
        OtlpMapper,
        TelemetrySanitizer,
        { provide: PrismaService, useValue: { project: { findFirst } } },
        { provide: IngestionRepository, useValue: { persist } },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    findFirst.mockResolvedValue({ id: 'project-a' });
    persist.mockResolvedValue();
  });
  afterAll(async () => {
    await app.close();
  });

  it('valida preflight com origem exata e não libera cookies', async () => {
    const response = await request(app.getHttpServer())
      .options(path)
      .set('Origin', 'http://localhost:3100')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3100',
    );
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        publicId: 'obs_pub_demo',
        allowedOrigins: { some: { origin: 'http://localhost:3100' } },
      },
      select: { id: true },
    });
  });
  it('recusa origem ausente e identificador privado', async () => {
    await request(app.getHttpServer()).post(path).send({}).expect(403);
    await request(app.getHttpServer())
      .options('/api/browser/obs_live_secret/v1/traces')
      .set('Origin', 'http://localhost:3100')
      .expect(403);
    expect(persist).not.toHaveBeenCalled();
  });
  it('recusa origem fora da allowlist', async () => {
    findFirst.mockResolvedValue(null);
    const response = await request(app.getHttpServer())
      .options(path)
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(persist).not.toHaveBeenCalled();
  });
  it('decodifica protobuf, preserva trace e parent, sanitiza e força serviço browser', async () => {
    await request(app.getHttpServer())
      .post(path)
      .set('Origin', 'http://localhost:3100')
      .set('Content-Type', 'application/x-protobuf')
      .send(payload)
      .expect(200)
      .expect('Content-Type', /application\/x-protobuf/);
    expect(persist).toHaveBeenCalledWith('project-a', [
      expect.objectContaining({
        traceId: traceId.toString('hex'),
        parentSpanId: parentSpanId.toString('hex'),
        serviceType: 'BROWSER',
        attributes: {},
      }),
    ]);
  });
  it('recusa protobuf malformado e tipo incorreto', async () => {
    await request(app.getHttpServer())
      .post(path)
      .set('Origin', 'http://localhost:3100')
      .set('Content-Type', 'application/x-protobuf')
      .send(Buffer.from([255]))
      .expect(400);
    await request(app.getHttpServer())
      .post(path)
      .set('Origin', 'http://localhost:3100')
      .send({})
      .expect(415);
    expect(persist).not.toHaveBeenCalled();
  });
  it('limita payload antes da persistência', async () => {
    await request(app.getHttpServer())
      .post(path)
      .set('Origin', 'http://localhost:3100')
      .set('Content-Type', 'application/x-protobuf')
      .send(Buffer.alloc(1024 * 1024 + 1))
      .expect(413);
    expect(persist).not.toHaveBeenCalled();
  });
  it('converte quota excedida em HTTP 429 sem expor erro interno', async () => {
    persist.mockRejectedValueOnce(
      new GrpcResourceExhaustedException('private driver detail'),
    );
    const response = await request(app.getHttpServer())
      .post(path)
      .set('Origin', 'http://localhost:3100')
      .set('Content-Type', 'application/x-protobuf')
      .send(payload)
      .expect(429);
    expect(JSON.stringify(response.body)).not.toContain(
      'private driver detail',
    );
  });
});
