# Etapa 7 — retenção e operação

## Implementação

A API agenda a limpeza de traces vencidos. Cada projeto usa seu próprio `retentionDays`; o padrão na criação é `TRACE_RETENTION_DAYS=7`. A idade é calculada pelo início do trace, e um período de proteção de cinco minutos desde o último recebimento evita remover traces durante a ingestão de lotes atrasados. Spans são removidos pela relação `ON DELETE CASCADE`. Usuários, projetos, ambientes, serviços e chaves não são removidos.

A primeira execução ocorre depois do intervalo configurado, sem bloquear a inicialização. O processo usa lotes, limite de execuções e orçamento de 30 segundos entre lotes; uma transação já iniciada pode estender esse orçamento em até dez segundos. A instância não sobrepõe seus próprios ciclos. Um advisory lock transacional no PostgreSQL coordena cada lote entre réplicas; `FOR UPDATE SKIP LOCKED` evita esperar por traces bloqueados por outra transação. Os limites são por ciclo e por instância; réplicas podem alternar lotes. O lock funciona com a conexão pooled do Neon porque dura somente a transação.

Cada lote limita o statement a cinco segundos e a transação a dez segundos. Em falha, registra somente um evento seguro e a contagem já removida; tenta novamente no próximo ciclo. O encerramento cancela o timer e aguarda o trabalho iniciado. Janelas antigas de quota são removidas em lotes após um dia. Não há endpoint público para disparar exclusões.

| Variável                     | Padrão | Máximo  |
| ---------------------------- | ------ | ------- |
| `TRACE_RETENTION_DAYS`       | 7      | 365     |
| `RETENTION_INTERVAL_SECONDS` | 3600   | 86400   |
| `RETENTION_BATCH_SIZE`       | 100    | 1000    |
| `RETENTION_MAX_BATCHES`      | 10     | 100     |
| `INGESTION_SPANS_PER_MINUTE` | 60000  | 1000000 |

Todos os valores precisam ser inteiros positivos. Alterar `TRACE_RETENTION_DAYS` muda o padrão para novos projetos; projetos existentes preservam sua política. No padrão, cada instância remove até mil traces por ciclo. Uma interrupção não deixa exclusões parciais dentro de um lote.

## Ingestão e quotas

`ingestion_windows` mantém um contador por projeto e minuto do relógio do PostgreSQL, compartilhado entre instâncias e entre todas as chaves do projeto. O incremento condicional e a persistência ocorrem na mesma transação serializável: se uma quota ou cardinalidade for excedida, nada desse lote é persistido nem debitado. Conflitos de serialização têm até três tentativas. Indisponibilidade de armazenamento retorna uma mensagem gRPC segura, sem detalhes do driver.

A quota contabiliza spans aceitos por exportação, inclusive retransmissões válidas; a unicidade de spans continua impedindo duplicação dos dados. A janela é fixa, não deslizante: cargas na virada do minuto podem consumir a quota de duas janelas em sequência. Excesso retorna `RESOURCE_EXHAUSTED`; o Collector poderá reenviar conforme sua política de retry. Não há garantia de entrega após o esgotamento da fila do Collector.

Cada trace pode ter no máximo dois mil spans distintos, mesmo quando chegam em exportações separadas; duplicatas não consomem essa capacidade. Permanecem os limites de dois mil spans por exportação, 20 ambientes por projeto e 200 serviços por ambiente. A criação administrativa de ambiente também respeita o teto de 20. A quota limita a taxa de entrada, sem representar uma garantia de capacidade ou de custo máximo do banco.

## HTTP e autenticação

- Nginx limita IPs na API e na entrada OTLP. Login/cadastro/refresh possuem uma zona específica de 10 requisições por minuto, com burst de dez; excesso retorna HTTP 429.
- A API limita tentativas por identidade normalizada (dez por minuto) e por endereço de conexão (120 por minuto), com `Retry-After`. Identificadores de conta ficam somente como SHA-256 em um mapa de até dez mil entradas, expiráveis em um minuto.
- O limitador da API é por processo e ignora `X-Forwarded-For` não confiável. Atrás do proxy, clientes compartilham o teto de conexão da API; o Nginx aplica o limite por IP real. Múltiplas réplicas podem multiplicar o limite por conta. Não é um substituto para um limitador distribuído de autenticação.
- JSON administrativo tem limite de 32 KiB. OTLP continua limitado a 4 MiB no transporte e no Nginx.
- Nginx tem timeouts de headers, corpo e envio, esconde a versão e envia proteções de tipo, referência e enquadramento. A API desabilita cache de respostas privadas.
- Compose exige segredos explícitos; não usa mais fallbacks conhecidos para JWT e pepper. A configuração local HTTP permanece de desenvolvimento; uma publicação exige TLS e ambiente de produção.

## Consultas e conexões

O pool possui no máximo dez conexões por processo, timeout de conexão de cinco segundos, de inatividade de 30 segundos e `statement_timeout` de oito segundos. O overview limita a transação a 15 segundos, com espera máxima de cinco segundos pelo pool.

A migration adiciona o índice `(project_id, started_at DESC, id DESC)`, alinhado com o filtro de projeto/período e a paginação determinística por recência. A pesquisa textual de operações continua literal e parametrizada. Não foi adicionado índice GIN sem uma consulta que o justifique.

## Aplicação e validação

Antes de iniciar a nova API, aplique as migrations conforme o README. No Docker, `migrate` já precede a API. Não há backfill nem exclusão na migration; exclusões ocorrem somente quando o worker executa.

```bash
pnpm db:migrate:deploy
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

O teste real é separado da suíte padrão e exige uma URL de branch isolado e confirmação explícita de isolamento. Ele executa a retenção do branch e deve ser usado somente em um branch descartável. Não use o `.env` principal.

```bash
# Prepare um arquivo fora do repositório com OPERATIONAL_TEST_DATABASE_URL.
OPERATIONAL_TEST_CONFIRM_ISOLATED=true pnpm --filter @tcc-observability/api exec tsx --env-file=/caminho/branch-de-teste.env test/operational.integration.mts
```

Em 19/10/2026, a migration foi aplicada no branch temporário `codex-stage7-validation-20261019` (expiração em 20/10/2026). O teste real verificou políticas de retenção distintas, cascade, período de proteção, coordenação do worker, quotas, renovação de janela, limites de spans, idempotência, percentis SQL e ownership. A suíte unitária cobre o agendamento, encerramento, recuperação de falhas e limitação HTTP. Com cinco mil traces sintéticos, o EXPLAIN de paginação por projeto/período usou `Index Only Scan` no novo índice, retornando 50 linhas em aproximadamente 0,06 ms no ambiente de teste; essa medição não é um benchmark de produção. Exportações concorrentes também foram testadas para comprovar que não ultrapassam a quota do projeto.

Referências de implementação: [locks e SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE), [advisory locks transacionais](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS).

A validação em branch e com carga sintética não demonstra capacidade de produção. O Collector/Nginx em containers não foram revalidados nesta etapa porque o Docker estava parado. O banco principal e o `.env` local permaneceram inalterados.
