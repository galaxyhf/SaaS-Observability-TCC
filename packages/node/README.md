# @tcc-observability/node

SDK server-side que reduz a configuração necessária para enviar traces OpenTelemetry à plataforma.

## Uso

```ts
import { initObservability } from '@tcc-observability/node';

const observability = initObservability({
  projectKey: process.env.OBS_PROJECT_KEY!,
  serviceName: 'envcove-server',
  environment: 'production',
  endpoint: 'http://localhost:4318/v1/traces',
  serviceVersion: '1.0.0',
});

await observability.shutdown();
```

`endpoint` é opcional e usa `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` ou `http://localhost:4318/v1/traces`. A Project Key deve começar com `obs_live_` e nunca pode ser usada no browser.

## Spans de domínio

```ts
import { traceOperation } from '@tcc-observability/node/trace-operation';

await traceOperation('order.authorizePayment', async () => authorizePayment(), {
  attributes: { 'order.quantity': 2 },
});
```

Use spans manuais somente quando a etapa de negócio não for representada pelas instrumentações automáticas. Não inclua tokens, dados pessoais, corpos de requisição ou valores de banco nos atributos.

## Garantias iniciais

- inicialização idempotente para a mesma configuração;
- erro explícito ao tentar reinicializar com outra configuração;
- auto-instrumentações oficiais do ecossistema OpenTelemetry;
- exportação OTLP/HTTP protobuf com Project Key em header;
- parâmetros PostgreSQL e headers HTTP não são capturados;
- encerramento do SDK disponível para shutdown gracioso.
