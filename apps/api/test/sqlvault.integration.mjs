// Com o SQLVault em http://localhost:3001 e o Observa em Docker:
// node --env-file=/caminho/observa/.env test/sqlvault.integration.mjs
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../dist/database/prisma.service.js';
const { chromium } = createRequire(
  new URL('../../../packages/browser/package.json', import.meta.url),
)('playwright');
const target =
  process.env.SQLVAULT_TEST_PATH ?? '/Users/caiosilva/Developer/SQLVault';
const env = await readFile(`${target}/.env.local`, 'utf8');
const publicId = env.match(/^NEXT_PUBLIC_OBS_PROJECT_ID=(.+)$/m)?.[1];
const privateKey = env.match(/^OBS_PROJECT_KEY=(.+)$/m)?.[1];
assert(publicId && privateKey);
const db = new PrismaService(
  new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
);
const marker = 'OBS_PRIVACY_SENTINEL_19847';
let browser;
try {
  const project = await db.project.findUniqueOrThrow({
    where: { publicId },
    include: { user: true },
  });
  const owner = project.user;
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: owner.id, email: owner.email, name: owner.name, type: 'access' },
    { expiresIn: 300 },
  );
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const exports = [];
  let traceparent;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/browser/'))
      exports.push(request.postDataBuffer());
    if (request.url().includes(':3001/api/sql-editor'))
      traceparent = request.headers().traceparent;
  });
  await page.goto('http://localhost:3001/dashboard');
  await page.goto('http://localhost:3001/editor');
  const status = await page.evaluate(async (marker) => {
    // Campos obrigatórios ausentes: o teste termina na validação e nunca executa SQL.
    const response = await fetch(`/api/sql-editor?token=${marker}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'execute',
        connection: { password: marker },
        sql: `SELECT '${marker}'`,
      }),
    });
    return response.status;
  }, marker);
  assert.equal(status, 400);
  assert.match(traceparent, /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  const [, traceId, browserSpanId] = traceparent.split('-');
  let detail;
  for (let attempt = 0; attempt < 25; attempt++) {
    const response = await context.request.get(
      `http://localhost/api/projects/${project.id}/traces/${traceId}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (response.ok()) {
      const value = await response.json();
      if (
        value.spans.some((span) => span.service.name === 'sqlvault-browser') &&
        value.spans.some((span) => span.service.name === 'sqlvault-server')
      ) {
        detail = value;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert(
    detail,
    'Browser e servidor do SQLVault devem chegar ao mesmo trace no Observa.',
  );
  assert(
    detail.spans.some(
      (span) =>
        span.service.name === 'sqlvault-server' &&
        span.parentSpanId === browserSpanId,
    ),
  );
  assert(
    !JSON.stringify(detail).includes(marker),
    'Conteúdo da requisição não deve aparecer na telemetria.',
  );
  assert(
    !JSON.stringify(detail).includes(privateKey),
    'Credencial não deve aparecer na telemetria.',
  );
  for (const body of exports) assert(!body?.includes(Buffer.from(marker)));
  assert(exports.length > 0);
  assert.deepEqual(pageErrors, []);
  const serverSpans = detail.spans.filter(
    (span) => span.service.name === 'sqlvault-server',
  );
  for (const span of serverSpans) {
    assert.deepEqual(span.events, []);
    assert(!('db.statement' in span.attributes));
    assert(!('process.command_args' in span.resourceAttributes));
  }
  const files = await readdir(`${target}/.next/static`, {
    recursive: true,
    withFileTypes: true,
  });
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.js')) continue;
    const content = await readFile(`${file.parentPath}/${file.name}`);
    assert(
      !content.includes(Buffer.from(privateKey)),
      'Chave privada não deve aparecer no bundle browser.',
    );
  }
  await context.addCookies([
    {
      name: 'obs_access',
      value: token,
      url: 'http://localhost',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const dashboard = await context.newPage();
  await dashboard.goto(
    `http://localhost/projects/${project.id}/traces/${traceId}`,
  );
  assert.equal(
    detail.spans.find((span) => span.spanId === browserSpanId)?.attributes[
      'http.route'
    ],
    '/api/sql-editor',
  );
  assert.equal(
    detail.spans.find((span) => span.spanId === browserSpanId)?.attributes[
      'obs.operation.label'
    ],
    'Solicitação ao editor SQL',
  );
  await dashboard
    .getByRole('heading', { name: 'Solicitação ao editor SQL', exact: true })
    .first()
    .waitFor();
  await dashboard
    .getByRole('heading', { name: 'Onde o tempo foi gasto' })
    .waitFor();
  assert(
    await dashboard.getByText('Navegador', { exact: true }).first().isVisible(),
  );
  assert(
    await dashboard.getByText('Servidor', { exact: true }).first().isVisible(),
  );
  assert(
    await dashboard
      .getByText('Sem etapas recebidas', { exact: true })
      .first()
      .isVisible(),
  );
  const expectedCategory = detail.status === 'ERROR' ? 'error' : 'request';
  const overviewResponse = await context.request.get(
    `http://localhost/api/projects/${project.id}/traces?category=${expectedCategory}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  assert.equal(overviewResponse.status(), 200);
  const overview = await overviewResponse.json();
  assert(overview.items.every((item) => item.category === expectedCategory));
  assert(
    overview.items.some(
      (item) =>
        item.traceId === traceId &&
        item.rootAttributes['obs.operation.label'] ===
          'Solicitação ao editor SQL',
    ),
  );
  const navResponse = await context.request.get(
    `http://localhost/api/projects/${project.id}/traces?category=navigation`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  assert.equal(navResponse.status(), 200);
  const navigations = await navResponse.json();
  assert(
    navigations.items.length > 0 &&
      navigations.items.every((item) => item.category === 'navigation'),
  );
  await dashboard.goto(
    `http://localhost/?project=${project.id}&view=activities`,
  );
  await dashboard.locator('.advanced-filters > summary').click();
  await dashboard
    .getByRole('combobox', { name: 'Tipo de atividade', exact: true })
    .selectOption(expectedCategory);
  await dashboard.getByRole('button', { name: 'Atualizar visão' }).click();
  await dashboard.waitForURL(new RegExp(`category=${expectedCategory}`));
  assert.equal(
    await dashboard.locator('select[name=category]').inputValue(),
    expectedCategory,
  );
  await dashboard
    .getByRole('link', { name: 'Solicitação ao editor SQL', exact: true })
    .first()
    .waitFor();
  await dashboard.screenshot({
    path: '/private/tmp/sqlvault-observa-activities.png',
    fullPage: true,
  });
  await dashboard.goto(
    `http://localhost/projects/${project.id}/traces/${traceId}`,
  );
  await dashboard
    .getByRole('heading', { name: 'Onde o tempo foi gasto' })
    .waitFor();
  await dashboard.screenshot({
    path: '/private/tmp/sqlvault-observa-waterfall.png',
    fullPage: true,
  });
  await dashboard.setViewportSize({ width: 390, height: 844 });
  assert(
    await dashboard.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await dashboard.screenshot({
    path: '/private/tmp/sqlvault-observa-waterfall-mobile.png',
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      status: 'passed',
      projectId: project.id,
      traceId,
      spans: detail.spans.length,
      browserExports: exports.length,
      sqlExecuted: false,
      privacy:
        'SQL, credenciais e mensagens ausentes da telemetria; chave ausente do bundle browser',
      screenshot: '/private/tmp/sqlvault-observa-waterfall.png',
    }),
  );
} finally {
  await browser?.close();
  await db.$disconnect();
}
