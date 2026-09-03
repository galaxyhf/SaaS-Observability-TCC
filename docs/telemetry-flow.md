# Fluxo de telemetria

## Fluxo Node.js

```text
Aplicação Node.js
→ SDK @tcc-observability/node
→ OTLP HTTP/gRPC com Project Key em metadata
→ Nginx
→ Collector
→ OTLP/gRPC interno
→ autenticação
→ sanitização
→ persistência
```

A Project Key nunca é copiada para atributos ou logs. O Collector preserva o metadata de tenant ao separar os batches por credencial e o encaminha somente como metadata gRPC interno.

O SDK Node exporta OTLP/HTTP protobuf para `/v1/traces`. O Collector recebe esse payload, aplica `memory_limiter` e batching particionado por `x-obs-project-key`, e o exporta como OTLP/gRPC para a porta interna `4319` da API. A plataforma não implementa um formato alternativo de telemetria.

## Aplicação demonstrativa

O serviço `demo-store-server` expõe cinco cenários controlados:

- `GET /api/fast`: resposta sem atraso proposital;
- `GET /api/slow`: atraso de 900 ms;
- `GET /api/error`: exceção controlada e resposta 500;
- `GET /api/database`: inicialização e consulta PostgreSQL;
- `POST /api/order`: validação, estoque, pagamento simulado e persistência em spans filhos.

As requisições HTTP e operações PostgreSQL são auto-instrumentadas. Os spans manuais representam apenas as etapas de domínio necessárias para explicar onde o tempo foi gasto.

## Contrato Collector → ingestão

- protocolo: OTLP/gRPC padrão;
- serviço: `opentelemetry.proto.collector.trace.v1.TraceService/Export`;
- porta interna: `4319`;
- autenticação: `x-obs-project-key`;
- limite da API: 4 MiB e 2.000 spans por exportação;
- resposta: sucesso vazio ou `partial_success` OTLP com quantidade rejeitada.

As definições protobuf são as oficiais do OpenTelemetry v1.7.0. O Collector mantém batches separados por Project Key, com limite de 100 combinações de metadata para controlar consumo de memória.

## Fluxo browser

```text
Browser
→ SDK @tcc-observability/browser
→ OTLP/HTTP com identificador público
→ Nginx com rate limit
→ Collector
→ ingestão
```

O projeto validará origem, quota e identificador público. CORS não será tratado como autenticação.

## Correlação

Instrumentações de fetch/XHR injetam `traceparent` apenas em origens permitidas. A instrumentação HTTP do backend extrai o contexto e cria um span filho. Instrumentações de PostgreSQL e clientes HTTP continuam a árvore.

```text
Browser navigation
└── fetch POST /api/order
    └── HTTP POST /api/order
        ├── order processing
        ├── PostgreSQL SELECT
        └── payment HTTP request
```

## Processamento fora de ordem

O Collector pode reenviar lotes, e spans de um trace podem chegar separadamente. A persistência usa unicidade e inserção com `skipDuplicates` para spans, atualizando o resumo parcial do trace quando chegam novos limites temporais ou o root span.

## Definição de request

Requests do dashboard correspondem principalmente a spans de entrada com kind `SERVER`. Contar todos os spans inflaria o volume com banco, funções internas e chamadas externas.
