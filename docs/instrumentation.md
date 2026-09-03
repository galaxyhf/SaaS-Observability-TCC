# Instrumentação

## Recursos obrigatórios

Cada SDK define pelo menos:

- `service.name`;
- `deployment.environment.name`;
- versão do SDK da plataforma;
- identificador do projeto pelo canal apropriado.

Browser e servidor no mesmo domínio continuam como serviços diferentes.

## Node.js

O pacote `@tcc-observability/node` configura o `NodeSDK`, exporter OTLP/HTTP protobuf, propagação de contexto padrão e auto-instrumentations oficiais. A inicialização deve ocorrer antes de importar frameworks ou drivers instrumentados.

```ts
import { initObservability } from '@tcc-observability/node';

initObservability({
  projectKey: process.env.OBS_PROJECT_KEY!,
  serviceName: 'envcove-server',
  environment: 'production',
  endpoint: 'http://localhost:4318/v1/traces',
});
```

O SDK valida a configuração, recusa endpoint com credenciais embutidas, envia a Project Key somente no header `x-obs-project-key` e mantém a inicialização idempotente. Instrumentações iniciais incluem HTTP, fetch/Undici, Express/NestJS, runtime server do Next.js e PostgreSQL quando suportados. A instrumentação de PostgreSQL desativa valores de parâmetros, e a de Undici não transforma headers em atributos.

`traceOperation` cria spans manuais apenas para regras de negócio que a instrumentação automática não conhece, como `saveSecret` ou `processOrder`. Exceções são registradas no span e propagadas ao chamador.

### Next.js

`src/instrumentation.ts` deve carregar um arquivo exclusivamente Node:

```ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
```

O arquivo `instrumentation-node.ts` chama `initObservability`. Isso evita executar APIs Node no runtime Edge e mantém a inicialização no ciclo oficial do Next.js.

## Browser

O pacote browser, previsto para a prioridade 2, coletará carregamento de documento, fetch/XHR, navegação e erros seguros. Como a instrumentação browser do OpenTelemetry é experimental, a API pública do pacote ficará isolada das implementações internas.

## Propagação

O header `traceparent` segue W3C Trace Context. A propagação cross-origin terá allowlist explícita para evitar enviar contexto a destinos arbitrários.

## Operações e cardinalidade

O nome preferencial de uma operação HTTP é método mais rota parametrizada, como `GET /users/:id`. URLs completas, query strings e IDs individuais não devem criar operações distintas.
