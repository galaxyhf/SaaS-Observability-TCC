import { Controller, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.config.js';
import { AuthRateLimit } from '../src/security/auth-rate-limit.js';
describe('Authentication throttling', () => {
  it('throttles each identity independently, returns a retry delay, and expires windows', () => {
    const limiter = new AuthRateLimit();
    for (let i = 0; i < 10; i++)
      expect(limiter.consume('account:a', 10, 1000)).toBe(0);
    expect(limiter.consume('account:a', 10, 1000)).toBe(60);
    expect(limiter.consume('account:b', 10, 1000)).toBe(0);
    expect(limiter.consume('account:a', 10, 61000)).toBe(0);
  });
  it('bounds memory under identity flooding', () => {
    const limiter = new AuthRateLimit();
    for (let i = 0; i < 10000; i++)
      expect(limiter.consume(String(i), 1, 0)).toBe(0);
    expect(limiter.consume('overflow', 1, 0)).toBe(60);
    expect(limiter.consume('overflow', 1, 60001)).toBe(0);
  });
});

@Controller('auth')
class TestAuthController {
  @Post('login') login() {
    return { ok: true };
  }
}
describe('Authentication HTTP boundary', () => {
  it('normalizes account identity, ignores spoofed IP headers and returns 429 with retry guidance', async () => {
    const module = await Test.createTestingModule({
      controllers: [TestAuthController],
    }).compile();
    const app = module.createNestApplication();
    configureApp(app);
    await app.init();
    try {
      for (let i = 0; i < 10; i++)
        await request(app.getHttpServer())
          .post(i % 2 ? '/API/AUTH/LOGIN' : '/api/auth/login')
          .set('X-Forwarded-For', `192.0.2.${i}`)
          .send({
            email: i % 2 ? '  USER@example.test  ' : 'user@example.test',
          })
          .expect(201);
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'user@example.test' })
        .expect(429);
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(response.body.message).toContain('Aguarde');
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'other@example.test' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'x'.repeat(40000) })
        .expect(413);
    } finally {
      await app.close();
    }
  });
});
