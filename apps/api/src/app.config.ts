import { ValidationPipe, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AuthRateLimit } from './security/auth-rate-limit.js';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(new AuthRateLimit().middleware);
  app.use(
    (
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'same-origin');
      response.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
}
