import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../src/app.config.js';
import { AppModule } from '../src/app.module.js';

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports that the API is healthy', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ service: 'observability-api', status: 'ok' });
  });
  it('requires real JWT authentication on the tracing routes', async () => {
    const base = '/api/projects/bbfa5ef9-1324-44cc-b0d6-37b9f5a056de';
    for (const suffix of [
      '/traces',
      '/services',
      `/traces/${'a'.repeat(32)}`,
    ]) {
      await request(app.getHttpServer())
        .get(base + suffix)
        .expect(401);
    }
  });
});
