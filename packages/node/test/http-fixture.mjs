// Servidor descartável usado somente pela integração Chromium/Node.
import { createRequire } from 'node:module';
import { trace } from '@opentelemetry/api';
import { initObservability } from '../dist/index.js';

const sdk = initObservability({
  projectKey: 'obs_live_integration_only',
  serviceName: 'integration-server',
  environment: 'test',
  endpoint: process.env.TEST_OTLP_ENDPOINT,
});
// require após inicialização permite que a auto-instrumentação intercepte HTTP.
const { createServer } = createRequire(import.meta.url)('node:http');
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'traceparent, tracestate');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({ traceId: trace.getActiveSpan()?.spanContext().traceId }),
  );
});
server.listen(0, '127.0.0.1', () =>
  process.send({ port: server.address().port }),
);
process.once('message', async () => {
  await new Promise((resolve) => server.close(resolve));
  await sdk.shutdown();
  process.disconnect();
});
