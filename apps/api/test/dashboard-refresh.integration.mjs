// Observa em Docker e SQLVault na porta 3001. Usa somente consultas e payload SQL inválido.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../dist/database/prisma.service.js';
const { chromium } = createRequire(
  new URL('../../../packages/browser/package.json', import.meta.url),
)('playwright');
const db = new PrismaService(
  new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
);
let browser;
try {
  const project = await db.project.findFirstOrThrow({
    where: { name: 'SQLVault' },
    include: { user: true },
  });
  const user = project.user;
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: user.id, email: user.email, name: user.name, type: 'access' },
    { expiresIn: 600 },
  );
  browser = await chromium.launch();
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
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const update = async () => {
    const response = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.origin === 'http://localhost' &&
        url.pathname === '/' &&
        url.searchParams.has('_rsc') &&
        response.ok()
      );
    });
    await page
      .getByRole('button', { name: 'Atualizar visão', exact: true })
      .click();
    await response;
    await page
      .getByRole('button', { name: 'Atualizar visão', exact: true })
      .waitFor();
  };
  await page.goto(`http://localhost/?project=${project.id}`);
  await page.getByRole('link', { name: 'Atividades', exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get('view') === 'activities');
  assert(
    new URL(page.url()).searchParams.has('from'),
    'Navegação preserva o snapshot exato.',
  );
  await update();
  const relativeUrl = new URL(page.url());
  assert(!relativeUrl.searchParams.has('from'));
  assert(!relativeUrl.searchParams.has('to'));
  assert(!relativeUrl.searchParams.has('sort'));
  assert.equal(
    (await page.locator('.advanced-filters summary').innerText()).trim(),
    'Mais filtros',
  );
  await page.locator('.advanced-filters').evaluate((element) => {
    element.open = true;
  });
  await page.locator('select[name=status]').selectOption('ERROR');
  await page.locator('select[name=period]').selectOption('1h');
  await update();
  assert.equal(new URL(page.url()).searchParams.get('status'), 'ERROR');
  assert.equal(await page.locator('select[name=status]').inputValue(), 'ERROR');
  assert.equal(
    (await page.locator('.advanced-filters summary').innerText()).trim(),
    'Mais filtros (1)',
  );
  await page.locator('select[name=period]').selectOption('custom');
  const to = Date.now() - 60000;
  const local = (value) =>
    new Date(value - 3 * 3600000).toISOString().slice(0, 16);
  const fromText = local(to - 86400000),
    toText = local(to);
  await page.locator('input[name=from]').fill(fromText);
  await page.locator('input[name=to]').fill(toText);
  await update();
  assert.equal(
    await page.locator('select[name=period]').inputValue(),
    'custom',
  );
  const customUrl = page.url();
  await update();
  assert.equal(page.url(), customUrl);
  assert.equal(await page.locator('input[name=from]').inputValue(), fromText);
  assert.equal(await page.locator('input[name=to]').inputValue(), toText);
  await page.locator('select[name=period]').selectOption('24h');
  await page.locator('.advanced-filters').evaluate((element) => {
    element.open = true;
  });
  await page.locator('select[name=status]').selectOption('');
  await update();
  const unchangedUrl = page.url();
  const application = await context.newPage();
  let traceparent;
  application.on('request', (request) => {
    if (request.url().includes(':3001/api/sql-editor'))
      traceparent = request.headers().traceparent;
  });
  await application.goto('http://localhost:3001/editor');
  const status = await application.evaluate(
    async () =>
      (
        await fetch('/api/sql-editor', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'execute' }),
        })
      ).status,
  );
  assert.equal(status, 400);
  assert(traceparent);
  const traceId = traceparent.split('-')[1];
  let persisted = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    const response = await context.request.get(
      `http://localhost/api/projects/${project.id}/traces/${traceId}`,
    );
    if (response.ok()) {
      const value = await response.json();
      if (
        value.spans.some((span) => span.kind === 'CLIENT') &&
        value.spans.some((span) => span.kind === 'SERVER')
      ) {
        persisted = true;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert(persisted);
  const traceLink = page
    .locator(`a[href^="/projects/${project.id}/traces/${traceId}"]`)
    .first();
  assert.equal(
    await traceLink.count(),
    0,
    'O trace foi criado após carregar a visão.',
  );
  await update();
  assert.equal(
    page.url(),
    unchangedUrl,
    'Mesmo URL deve consultar dados novos.',
  );
  await traceLink.waitFor();
  assert.equal(
    (await page.locator('.advanced-filters summary').innerText()).trim(),
    'Mais filtros',
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: 'passed',
      relativeRefresh: true,
      sameUrlShowsNewTrace: traceId,
      explicitFiltersPreserved: true,
      custom24hPreserved: true,
      phantomFilters: 0,
    }),
  );
} finally {
  await browser?.close();
  await db.$disconnect();
}
