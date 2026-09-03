import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MicroserviceOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';

function protoRoot(): string {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(currentDirectory, 'proto'),
    join(process.cwd(), 'src/ingestion/proto'),
    join(process.cwd(), 'apps/api/src/ingestion/proto'),
  ];
  const result = candidates.find((candidate) => existsSync(candidate));
  if (!result) {
    throw new Error('As definições protobuf do OTLP não foram encontradas.');
  }
  return result;
}

export function ingestionGrpcOptions(port: number): MicroserviceOptions {
  const root = protoRoot();
  return {
    transport: Transport.GRPC,
    options: {
      loader: {
        defaults: false,
        enums: Number,
        includeDirs: [root],
        longs: String,
        oneofs: true,
      },
      package: 'opentelemetry.proto.collector.trace.v1',
      maxReceiveMessageLength: 4 * 1_024 * 1_024,
      protoPath: join(
        root,
        'opentelemetry/proto/collector/trace/v1/trace_service.proto',
      ),
      url: `0.0.0.0:${port}`,
    },
  };
}
