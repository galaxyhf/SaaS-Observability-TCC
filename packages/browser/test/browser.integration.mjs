// pnpm --filter @tcc-observability/browser test:browser
// Requer: pnpm --filter @tcc-observability/browser exec playwright install chromium
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fork } from 'node:child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

export const browserCapture = {
  exported: [],
  serverExports: [],
  received: [],
  origin: undefined,
};
const exported = browserCapture.exported;
const received = browserCapture.received;
let bundle;
const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, traceparent, tracestate',
  );
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.url.startsWith('/api/browser/') || req.url === '/server/v1/traces') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    (req.url === '/server/v1/traces'
      ? browserCapture.serverExports
      : exported
    ).push(Buffer.concat(chunks));
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.end();
  } else if (req.url === '/sdk.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(bundle);
  } else if (req.url.startsWith('/request')) {
    received.push({ url: req.url, traceparent: req.headers.traceparent });
    res.setHeader('Content-Type', 'application/json');
    res.end('{}');
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<html><head><title>SDK smoke</title></head><body><script src="/sdk.js"></script></body></html>',
    );
  }
};
const server = createServer(handler);
const other = createServer(handler);
let browser;
let backend;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  other.listen(0, '127.0.0.1');
  await once(other, 'listening');
  const origin = `http://localhost:${server.address().port}`;
  browserCapture.origin = origin;
  const allowed = `http://127.0.0.1:${server.address().port}`;
  const denied = `http://127.0.0.1:${other.address().port}`;
  backend = fork(
    fileURLToPath(new URL('../../node/test/http-fixture.mjs', import.meta.url)),
    [],
    {
      env: { ...process.env, TEST_OTLP_ENDPOINT: `${origin}/server/v1/traces` },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    },
  );
  const [{ port: backendPort }] = await once(backend, 'message', {
    signal: AbortSignal.timeout(15_000),
  });
  const backendOrigin = `http://127.0.0.1:${backendPort}`;
  const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));
  const result = await build({
    stdin: {
      contents: `import { initObservability } from ${JSON.stringify(entry)}; window.sdk = initObservability(${JSON.stringify({ projectId: 'obs_pub_smoke', serviceName: 'smoke-browser', environment: 'test', endpoint: origin, propagateToOrigins: [allowed, backendOrigin] })});`,
      resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.evaluate(
    async ({ allowed, denied, backendOrigin }) => {
      await fetch('/request?secret=private');
      window.backendTrace = await (
        await fetch(`${backendOrigin}/request`)
      ).json();
      await fetch(`${allowed}/request?secret=private`);
      await fetch(`${denied}/request?secret=private`);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = resolve;
        xhr.onerror = reject;
        xhr.open('GET', '/request-xhr');
        xhr.send();
      });
      window.dispatchEvent(
        new ErrorEvent('error', { message: 'private password' }),
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
      history.pushState({}, '', '/private-path?secret=private');
      history.replaceState({}, '', '/');
      // FetchInstrumentation termina spans após coleta dos Resource Timings.
      await new Promise((resolve) => setTimeout(resolve, 700));
      await window.sdk.flush();
    },
    { allowed, denied, backendOrigin },
  );
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.match(received[0].traceparent, /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  assert.match(received[1].traceparent, /^00-/);
  assert.equal(
    received[2].traceparent,
    undefined,
    'Não propaga a origem fora da allowlist',
  );
  assert.match(received[3].traceparent, /^00-/, 'XHR também propaga contexto');
  const backendTrace = await page.evaluate(() => window.backendTrace);
  assert.match(backendTrace.traceId, /^[a-f0-9]{32}$/);
  browserCapture.backendTraceId = backendTrace.traceId;
  backend.send('shutdown');
  await once(backend, 'exit', { signal: AbortSignal.timeout(15_000) });
  assert.ok(
    browserCapture.serverExports.length > 0,
    'SDK Node exportou spans automáticos',
  );
  assert.ok(exported.length > 0, 'Exportou OTLP protobuf no navegador');
  const bytes = Buffer.concat(exported).toString('utf8');
  assert.ok(bytes.includes('smoke-browser'));
  assert.ok(bytes.includes('http.route'));
  assert.ok(bytes.includes('obs.activity.type'));
  assert.ok(bytes.includes('document.load'));
  assert.ok(bytes.includes('navigation'));
  assert.ok(bytes.includes('browser.error'));
  assert.ok(
    !bytes.includes('private'),
    'Não exporta segredos em URL ou mensagem de erro',
  );
  assert.ok(!bytes.includes('obs_live_'));
  await page.evaluate(() => window.sdk.shutdown());
  console.log(
    'Chromium: fetch, XHR, propagação permitida/bloqueada, documento, navegação, erros e OTLP protobuf passaram, incluindo contexto recebido pelo SDK Node automático.',
  );
} finally {
  await browser?.close();
  if (backend && backend.exitCode === null) backend.kill();
  server.closeAllConnections();
  other.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => other.close(resolve)),
  ]);
}
