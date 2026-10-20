// Execute somente com BROWSER_TEST_DATABASE_URL apontando para um branch descartável.
// pnpm --filter @tcc-observability/api exec node --env-file=/caminho/teste.env test/browser.integration.mjs
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { loadSync } from '@grpc/proto-loader';
import { join } from 'node:path';
import { PrismaService } from '../dist/database/prisma.service.js';
import {
  BrowserIngestionController,
  BrowserOriginPolicy,
} from '../dist/ingestion/browser-ingestion.controller.js';
import { IngestionRepository } from '../dist/ingestion/ingestion.repository.js';
import { OtlpMapper } from '../dist/ingestion/otlp-mapper.js';
import { IngestionService } from '../dist/ingestion/ingestion.service.js';
import { IngestionAuthService } from '../dist/ingestion/ingestion-auth.service.js';
import { IngestionAuthRepository } from '../dist/ingestion/ingestion-auth.repository.js';
import { hashProjectKey } from '../dist/projects/project-key.crypto.js';
import { TelemetrySanitizer } from '../dist/ingestion/telemetry-sanitizer.js';
import { protoRoot } from '../dist/ingestion/ingestion-grpc.options.js';
import { TracingRepository } from '../dist/tracing/tracing.repository.js';
import { ProjectsRepository } from '../dist/projects/projects.repository.js';
import { ProjectsService } from '../dist/projects/projects.service.js';

assert(
  process.env.BROWSER_TEST_DATABASE_URL &&
    process.env.BROWSER_TEST_CONFIRM_ISOLATED === 'true',
  'Exige URL e confirmação de branch isolado.',
);
const { browserCapture } =
  await import('../../../packages/browser/test/browser.integration.mjs');
const config = new ConfigService({
  DATABASE_URL: process.env.BROWSER_TEST_DATABASE_URL,
  INGESTION_SPANS_PER_MINUTE: 60000,
  PROJECT_KEY_PEPPER: randomUUID(),
});
const db = new PrismaService(config);
const mapper = new OtlpMapper(new TelemetrySanitizer());
const repository = new IngestionRepository(db, config);
const controller = new BrowserIngestionController(
  new BrowserOriginPolicy(db),
  mapper,
  repository,
);
const authRepository = new IngestionAuthRepository(db);
const privateIngestion = new IngestionService(
  new IngestionAuthService(config, authRepository),
  authRepository,
  mapper,
  repository,
);
const projects = new ProjectsService(config, new ProjectsRepository(db));
const traces = new TracingRepository(db);
let user;
try {
  user = await db.user.create({
    data: {
      name: 'Browser integration',
      email: `${randomUUID()}@integration.test`,
      passwordHash: 'test-only',
    },
  });
  const project = await db.project.create({
    data: {
      userId: user.id,
      name: 'Browser integration',
      slug: randomUUID(),
      publicId: 'obs_pub_smoke' + randomUUID(),
      keys: {
        create: {
          prefix: 'integration',
          keyHash: hashProjectKey(
            'obs_live_integration_only',
            config.getOrThrow('PROJECT_KEY_PEPPER'),
          ),
        },
      },
    },
  });
  await projects.updateBrowserOrigins(user.id, project.id, [
    browserCapture.origin,
  ]);
  const publicConfig = await projects.browserConfig(user.id, project.id);
  assert.deepEqual(publicConfig.origins, [browserCapture.origin]);
  await assert.rejects(
    () => projects.updateBrowserOrigins(randomUUID(), project.id, []),
    /Projeto não encontrado/,
  );
  await assert.rejects(
    () => projects.browserConfig(randomUUID(), project.id),
    /Projeto não encontrado/,
  );
  await assert.rejects(() =>
    projects.updateBrowserOrigins(user.id, project.id, [
      'https://example.com/path',
    ]),
  );
  const response = { setHeader() {}, type() {} };
  for (const body of browserCapture.exported) {
    await controller.ingest(
      project.publicId,
      browserCapture.origin,
      'application/x-protobuf',
      body,
      response,
    );
  }
  const definitions = loadSync(
    join(
      protoRoot(),
      'opentelemetry/proto/collector/trace/v1/trace_service.proto',
    ),
    { includeDirs: [protoRoot()], longs: String, enums: Number },
  );
  const method =
    definitions['opentelemetry.proto.collector.trace.v1.TraceService'].Export;
  const serverSpans = [];
  for (const body of browserCapture.serverExports) {
    const request = method.requestDeserialize(body);
    await privateIngestion.ingest('obs_live_integration_only', request);
    serverSpans.push(...mapper.map(request).spans);
  }
  const traceId = browserCapture.backendTraceId;
  const serverSpan = serverSpans.find(
    (span) => span.traceId === traceId && span.kind === 'SERVER',
  );
  assert(serverSpan, 'SDK Node exportou o span SERVER do contexto recebido');
  const parentSpanId = serverSpan.parentSpanId;
  const detail = await traces.detail(user.id, project.id, traceId);
  assert(detail);
  assert.equal(detail.spans.length, 2);
  assert.equal(
    detail.spans.find((span) => span.spanId === serverSpan.spanId).parentSpanId,
    parentSpanId,
  );
  const services = await db.service.findMany({
    where: { projectId: project.id },
  });
  assert.equal(new Set(services.map((service) => service.type)).size, 2);
  assert.equal(
    services.find((service) => service.name === 'smoke-browser').type,
    'BROWSER',
  );
  assert.equal(await traces.detail(randomUUID(), project.id, traceId), null);
  const before = await db.span.count({
    where: { trace: { projectId: project.id } },
  });
  await controller.ingest(
    project.publicId,
    browserCapture.origin,
    'application/x-protobuf',
    browserCapture.exported[0],
    response,
  );
  assert.equal(
    await db.span.count({ where: { trace: { projectId: project.id } } }),
    before,
  );
  await projects.updateBrowserOrigins(user.id, project.id, []);
  await assert.rejects(
    () =>
      controller.preflight(project.publicId, browserCapture.origin, response),
    /Origem ou projeto/,
  );
  console.log(
    'Neon isolado: OTLP real do Chromium persistido, serviços BROWSER/SERVER, parent preservado, idempotência, ownership e revogação de origem passaram.',
  );
} finally {
  if (user) await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
