import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { configureApp } from './app.config.js';
import { AppModule } from './app.module.js';
import { ingestionGrpcOptions } from './ingestion/ingestion-grpc.options.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('API_PORT');
  const ingestionPort = configService.getOrThrow<number>('INGESTION_GRPC_PORT');

  configureApp(app);
  app.enableShutdownHooks();
  app.connectMicroservice(ingestionGrpcOptions(ingestionPort));

  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
