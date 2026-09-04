import { jest } from '@jest/globals';
import {
  type INestApplication,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.config.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { ProjectsService } from '../src/projects/projects.service.js';
import { TracingController } from '../src/tracing/tracing.controller.js';
import { TracingService } from '../src/tracing/tracing.service.js';
import { TracingRepository } from '../src/tracing/tracing.repository.js';
import { TraceQueryDto, queryPeriod } from '../src/tracing/trace-query.dto.js';

const projectId = 'bbfa5ef9-1324-44cc-b0d6-37b9f5a056de';
const userId = '84e5d859-f527-4cef-af7a-e7cdbf900c58';
const repository = {
  overview: jest.fn(async () => ({ items: [] })),
  services: jest.fn(async () => []),
  detail: jest.fn(async (): Promise<unknown> => null),
};
const projects = { requireOwnedProject: jest.fn(async () => ({})) };

describe('Tracing REST boundary', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TracingController],
      providers: [
        TracingService,
        { provide: TracingRepository, useValue: repository },
        { provide: ProjectsService, useValue: projects },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) return false;
          req.user = { id: userId };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('denies unauthenticated reads', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/traces`)
      .expect(403);
    expect(repository.overview).not.toHaveBeenCalled();
  });
  it('passes validated filters with the authenticated owner', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/projects/${projectId}/traces?minDurationMs=12.5&page=2&sort=slowest`,
      )
      .set('Authorization', 'test')
      .expect(200);
    expect(repository.overview).toHaveBeenCalledWith(
      userId,
      projectId,
      expect.objectContaining({
        minDurationMs: 12.5,
        page: 2,
        sort: 'slowest',
      }),
    );
  });
  it.each([
    'page=0',
    'page=1001',
    'minDurationMs=-1',
    'status=bad',
    'serviceId=bad',
    'from=not-a-date',
    'unknown=1',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/traces?${query}`)
      .set('Authorization', 'test')
      .expect(400);
    expect(repository.overview).not.toHaveBeenCalled();
  });
  it.each(['traces', 'services', `traces/${'a'.repeat(32)}`])(
    'does not read another owner project: %s',
    async (path) => {
      projects.requireOwnedProject.mockRejectedValueOnce(
        new NotFoundException(),
      );
      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/${path}`)
        .set('Authorization', 'test')
        .expect(404);
      expect(repository.overview).not.toHaveBeenCalled();
      expect(repository.services).not.toHaveBeenCalled();
      expect(repository.detail).not.toHaveBeenCalled();
    },
  );
  it('rejects malformed trace IDs', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/traces/bad`)
      .set('Authorization', 'test')
      .expect(400);
  });
  it('reports missing or expired trace', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/traces/${'a'.repeat(32)}`)
      .set('Authorization', 'test')
      .expect(404);
  });
  it('serializes duration and exposes truncated spans', async () => {
    repository.detail.mockResolvedValueOnce({
      durationMs: '1.123',
      _count: { spans: 2001 },
      spans: [{ durationMs: '0.001' }],
    });
    const result = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/traces/${'a'.repeat(32)}`)
      .set('Authorization', 'test')
      .expect(200);
    expect(result.body).toMatchObject({
      durationMs: 1.123,
      truncated: true,
      spans: [{ durationMs: 0.001 }],
    });
  });
});

describe('Query periods', () => {
  it('uses a 24 hour default ending now', () => {
    const now = new Date('2026-09-03T12:00:00Z');
    expect(queryPeriod(new TraceQueryDto(), now)).toEqual({
      from: new Date('2026-09-02T12:00:00Z'),
      to: now,
    });
  });
  it('treats timezone-less datetime-local input as explicit UTC', () => {
    expect(
      queryPeriod({
        ...new TraceQueryDto(),
        from: '2026-09-02T12:00',
        to: '2026-09-03T12:00',
      }).from.toISOString(),
    ).toBe('2026-09-02T12:00:00.000Z');
  });
  it.each([
    ['2026-09-03T12:00Z', '2026-09-02T12:00Z'],
    ['2026-01-01T00:00Z', '2026-09-03T00:00Z'],
    ['2026-09-03T12:00Z', '2026-09-03T12:00Z'],
  ])('rejects inverted, oversized and empty periods', (from, to) => {
    expect(() => queryPeriod({ ...new TraceQueryDto(), from, to })).toThrow();
  });
});
