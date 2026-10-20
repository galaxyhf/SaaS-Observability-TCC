// Verifica o Compose local com as credenciais existentes, sem imprimi-las.
// node --env-file=/caminho/absoluto/.env test/docker.integration.mjs [--configure]
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../dist/database/prisma.service.js';
import { hashProjectKey } from '../dist/projects/project-key.crypto.js';

const { chromium } = createRequire(
  new URL('../../../packages/browser/package.json', import.meta.url),
)('playwright');
assert(
  process.env.DEMO_OBS_PROJECT_KEY &&
    process.env.PROJECT_KEY_PEPPER &&
    process.env.JWT_SECRET,
);
const db = new PrismaService(
  new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
);
let browser;
try {
  const key = await db.projectKey.findUnique({
    where: {
      keyHash: hashProjectKey(
        process.env.DEMO_OBS_PROJECT_KEY,
        process.env.PROJECT_KEY_PEPPER,
      ),
    },
    include: { project: { include: { user: true, allowedOrigins: true } } },
  });
  assert(
    key && !key.revokedAt,
    'Chave configurada na demo precisa estar ativa.',
  );
  const project = key.project;
  const owner = project.user;
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: owner.id, email: owner.email, name: owner.name, type: 'access' },
    { expiresIn: 300 },
  );
  if (process.argv.includes('--configure')) {
    await db.projectAllowedOrigin.upsert({
      where: {
        projectId_origin: {
          projectId: project.id,
          origin: 'http://localhost:3100',
        },
      },
      create: { projectId: project.id, origin: 'http://localhost:3100' },
      update: {},
    });
    const path = new URL('../../../.env', import.meta.url);
    let env = await readFile(path, 'utf8');
    for (const [name, value] of Object.entries({
      NEXT_PUBLIC_OBS_PROJECT_ID: project.publicId,
      NEXT_PUBLIC_OBS_ENDPOINT: 'http://localhost',
      NEXT_PUBLIC_OBS_ENVIRONMENT:
        process.env.DEMO_OBS_ENVIRONMENT ?? 'development',
    })) {
      const line = `${name}=${value}`;
      const pattern = new RegExp(`^${name}=.*$`, 'm');
      env = pattern.test(env)
        ? env.replace(pattern, line)
        : `${env.trimEnd()}\n${line}\n`;
    }
    await writeFile(path, env);
    console.log(
      'Demo configurada: identificador público do projeto existente, origem localhost:3100 e ambiente alinhados. Chave privada preservada.',
    );
  } else {
    for (const url of [
      'http://localhost/healthz',
      'http://localhost/api/health',
      'http://localhost:13133/',
      'http://localhost:3100/api/health',
    ]) {
      const response = await fetch(url);
      assert(response.ok, `${url}: ${response.status}`);
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'obs_access',
        value: token,
        url: 'http://localhost',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const demo = await context.newPage();
    const failures = [];
    const consoleErrors = [];
    const sent = [];
    demo.on('pageerror', (error) => consoleErrors.push(error.message));
    demo.on('response', (response) => {
      if (response.url().includes('/api/browser/'))
        sent.push(response.status());
    });
    demo.on('request', (request) => {
      if (request.url().includes(':3100/api/') && request.headers().traceparent)
        sent.push({
          url: request.url(),
          traceparent: request.headers().traceparent,
        });
    });
    await demo.goto('http://localhost:3100');
    for (const [name, endpoint, status] of [
      ['Executar Requisição rápida', '/api/fast', 200],
      ['Executar Requisição lenta', '/api/slow', 200],
      ['Executar Erro proposital', '/api/error', 500],
      ['Executar Consulta ao banco', '/api/database', 200],
      ['Executar Processar pedido', '/api/order', 200],
    ]) {
      const button = demo.getByRole('button', { name, exact: true });
      if (!(await button.count())) {
        failures.push(`Botão ausente: ${name}`);
        break;
      }
      const responsePromise = demo.waitForResponse(
        (response) => new URL(response.url()).pathname === endpoint,
      );
      await button.click();
      const response = await responsePromise;
      assert.equal(response.status(), status, endpoint);
      await button.waitFor({ state: 'visible' });
      await demo.waitForFunction(
        () => !document.querySelector('.run-button[disabled]'),
      );
    }
    assert.deepEqual(failures, []);
    const requests = sent.filter((item) => typeof item === 'object');
    assert(
      requests.length >= 5,
      'SDK browser precisa propagar traceparent nos cenários.',
    );
    const details = [];
    for (const request of requests) {
      const traceId = request.traceparent.split('-')[1];
      let detail;
      for (let attempt = 0; attempt < 25; attempt++) {
        const response = await context.request.get(
          `http://localhost/api/projects/${project.id}/traces/${traceId}`,
        );
        if (response.ok()) {
          const body = await response.json();
          if (
            body.spans.some((span) => span.kind === 'CLIENT') &&
            body.spans.some((span) => span.kind === 'SERVER')
          ) {
            detail = body;
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      assert(detail, `Browser/servidor no mesmo trace: ${request.url}`);
      const client = detail.spans.find(
        (span) => span.spanId === request.traceparent.split('-')[2],
      );
      assert(client);
      assert(
        detail.spans.some(
          (span) =>
            span.kind === 'SERVER' && span.parentSpanId === client.spanId,
        ),
      );
      const path = new URL(request.url).pathname;
      if (path === '/api/error') assert.equal(detail.status, 'ERROR');
      if (path === '/api/slow') assert(detail.durationMs >= 850);
      if (path === '/api/database')
        assert(
          detail.spans.some(
            (span) =>
              span.attributes['db.system'] || span.attributes['db.system.name'],
          ),
          'Consulta deve incluir span do PostgreSQL.',
        );
      if (path === '/api/order')
        for (const operation of [
          'processOrder',
          'validateOrder',
          'checkInventory',
          'authorizePayment',
          'persistOrder',
        ])
          assert(
            detail.spans.some((span) => span.name === operation),
            operation,
          );
      details.push(detail);
    }
    const detail = details.at(-1);
    const traceId = detail.traceId;
    assert(
      sent.includes(200),
      'Ingestão pública pelo Nginx deve responder 200.',
    );
    const dashboard = await context.newPage();
    await dashboard.goto(`http://localhost/?project=${project.id}`);
    assert(!dashboard.url().includes('/login'));
    await dashboard.goto(
      `http://localhost/projects/${project.id}/traces/${traceId}`,
    );
    await dashboard
      .getByRole('heading', { name: 'Onde o tempo foi gasto' })
      .waitFor();
    assert((await dashboard.locator('.span-row').count()) >= 2);
    await dashboard.screenshot({
      path: '/private/tmp/observa-docker-waterfall.png',
      fullPage: true,
    });
    console.log(
      JSON.stringify({
        status: 'passed',
        scenarios: 5,
        correlatedTraces: details.length,
        projectId: project.id,
        traceId,
        spans: detail.spans.length,
        browserOtlp200: sent.filter((item) => item === 200).length,
        dashboard: 'waterfall browser/server visível',
        screenshot: '/private/tmp/observa-docker-waterfall.png',
      }),
    );
  }
} finally {
  await browser?.close();
  await db.$disconnect();
}
