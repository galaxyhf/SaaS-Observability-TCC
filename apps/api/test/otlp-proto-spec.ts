import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSync } from '@grpc/proto-loader';

describe('OTLP protobuf contract', () => {
  it('loads the official TraceService and all imported definitions', () => {
    const testDirectory = dirname(fileURLToPath(import.meta.url));
    const root = join(testDirectory, '../src/ingestion/proto');
    const definition = loadSync(
      join(root, 'opentelemetry/proto/collector/trace/v1/trace_service.proto'),
      { includeDirs: [root] },
    );

    expect(
      definition['opentelemetry.proto.collector.trace.v1.TraceService'],
    ).toBeDefined();
  });
});
