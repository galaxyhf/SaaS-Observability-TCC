# @tcc-observability/browser

SDK de tracing para navegadores, usando OpenTelemetry e OTLP/HTTP protobuf. Importe somente em código cliente; no Next.js, use `src/instrumentation-client.ts`.

```ts
import { initObservability } from '@tcc-observability/browser';

const observability = initObservability({
  projectId: 'obs_pub_identificador_do_projeto',
  serviceName: 'store-browser',
  environment: 'production',
  endpoint: 'https://observa.example.com',
  propagateToOrigins: ['https://api.example.com'],
  sampleRate: 0.25,
});

await observability.flush();
// Ao desmontar permanentemente a instrumentação:
await observability.shutdown();
```

`endpoint` é a origem pública da plataforma (sem caminhos, query ou credenciais). O exporter usa `/api/browser/:publicId/v1/traces`. Configure a origem exata do site na API administrativa antes de enviar spans. Nunca use `obs_live_` ou Project Key neste pacote.

O SDK instrumenta fetch e XMLHttpRequest, registra carregamento inicial, mudanças por History API/popstate/hashchange, erros globais e rejeições de promises. Navegações são spans independentes. Fetch/XHR criam spans CLIENT e injetam W3C `traceparent` na mesma origem e nas origens exatas de `propagateToOrigins`. Não se propaga baggage. APIs cross-origin precisam aceitar os headers `traceparent` e `tracestate` no CORS.

O servidor deve usar o SDK Node e a Project Key do mesmo projeto, com o mesmo ambiente e outro nome de serviço. O span HTTP do servidor compartilha o trace ID e usa como pai o span CLIENT do browser. O carregamento do documento não é conectado automaticamente ao trace da resposta HTML. A atribuição de contexto entre tarefas assíncronas arbitrárias não é garantida pelo context manager padrão; fetch/XHR individuais mantêm a correlação com o backend.

Uma allowlist de atributos permite somente método, status HTTP e origem da URL. Caminhos, query strings, fragmentos, headers, corpos, atributos extras, mensagens/stacks de exceções, eventos e links são removidos antes da exportação. Os nomes são genéricos para impedir dados sensíveis em nomes de spans; o backend continua sanitizando os dados recebidos. Erros globais registram ocorrência e status, sem mensagem original.

Sampling usa `ParentBasedSampler` e taxa entre zero e um (padrão um). A fila contém até 500 spans, exporta até 100 por lote a cada dois segundos e tenta flush quando a página fica oculta ou sai. O navegador pode encerrar a página antes da entrega; não há garantia de entrega no fechamento. O endpoint do exporter é excluído da instrumentação para evitar recursão.

A inicialização é idempotente para a mesma configuração e recusa configurações diferentes enquanto ativa. `shutdown` desativa instrumentações, restaura History API, remove listeners e encerra o provider. O SDK deve ser o único responsável pelo provider global de tracing da aplicação.

```bash
pnpm --filter @tcc-observability/browser test
pnpm --filter @tcc-observability/browser exec playwright install chromium
pnpm --filter @tcc-observability/node build
pnpm --filter @tcc-observability/browser test:browser
```

A instrumentação browser oficial continua experimental; a API pública deste pacote isola essa dependência. Veja a [documentação oficial de browser](https://opentelemetry.io/docs/languages/js/getting-started/browser/) e a [etapa 8](../../docs/browser-sdk.md).

### Rotas e nomes legíveis

O SDK envia método e rota normalizada, substituindo segmentos desconhecidos por `:id` e removendo query e fragmento. Para preservar rotas específicas ou definir nomes de negócio, use `routes: [{ path: "/api/orders/:id", method: "GET", label: "Consultar pedido" }]` em `initObservability`. Rótulos devem ser estáticos e públicos. Veja `docs/activity-names.md` no repositório.
