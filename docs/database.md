# Banco de dados

## Ambientes

O projeto usa exclusivamente Neon PostgreSQL, inclusive no desenvolvimento. A aplicação utiliza uma conexão pooled no runtime; operações administrativas e migrations usam a conexão direta do mesmo banco.

## Modelo implementado

```text
User
└── Project
    ├── ProjectKey
    ├── ProjectAllowedOrigin
    └── Environment
        ├── Service
        └── Trace
            └── Span
```

### Identificadores

- chaves primárias administrativas: UUID;
- trace ID OTLP: 32 caracteres hexadecimais;
- span ID OTLP: 16 caracteres hexadecimais;
- Project Key: segredo mostrado uma vez, com HMAC-SHA-256 persistido;
- project ID browser: identificador público aleatório.

### Idempotência

`Trace(projectId, traceId)` e `Span(traceRecordId, spanId)` serão únicos. Isso permite que retries do Collector sejam processados com upsert sem duplicar telemetria.

### Precisão

Datas usarão `timestamptz` com precisão de microssegundos. Durações serão armazenadas em milissegundos decimais, preservando frações. A ingestão validará que o final não preceda o início.

### JSONB

Atributos de resource/span, eventos e links usam JSONB após sanitização e limitação. Índices GIN só serão adicionados para consultas demonstradas, evitando custo de escrita sem benefício.

## Índices prioritários

- projeto, environment e `startedAt` em traces;
- projeto e duração;
- projeto, status e tempo;
- trace/span IDs;
- service e início/duração;
- status de span e início;
- `parentSpanId` para a árvore do waterfall.

## Percentis

Percentis serão calculados pelo PostgreSQL com `percentile_cont(0.50)`, `percentile_cont(0.95)` e `percentile_cont(0.99)`. Média não será usada como substituta de percentil.

## Retenção

Cada projeto possui uma quantidade de dias de retenção. A API remove traces vencidos em lotes, com proteção de cinco minutos desde o último recebimento e cascade de spans. O trabalho tem limites por ciclo e coordenação transacional entre instâncias. `ingestion_windows` mantém quotas por projeto e minuto. Veja [retenção e operação](retention-and-hardening.md).

## Prisma e migrations

O pacote `@tcc-observability/database` usa Prisma 7, generator ESM `prisma-client`, output explícito e adapter `pg`. A migration inicial está em `packages/database/prisma/migrations`.

O runtime usa `DATABASE_URL`, com hostname `-pooler`. A CLI de migrations usa `DATABASE_URL_UNPOOLED`, sem `-pooler`, mantendo o tráfego normal separado das operações administrativas.
