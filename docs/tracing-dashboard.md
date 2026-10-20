# Dashboard de tracing — etapa 6

## Escopo implementado

- Cadastro, login, logout e renovação manual de sessão pela API existente.
- Seleção e criação de projetos com revelação única da Project Key.
- Consulta de traces com filtros e paginação de 50 registros.
- Total de traces, total/taxa de erros, p50, p95 e p99.
- Volume distribuído em 24 intervalos e tabela acessível equivalente.
- Até 20 operações raiz ordenadas por p95 decrescente.
- Waterfall com hierarquia, duração, status e seleção de span.
- Inspeção de atributos sanitizados, recurso, eventos, links e mensagem de erro.
- Estados de carregamento, erro, ausência de resultados e registro indisponível.

## Contratos REST

Todos os endpoints exigem JWT do usuário e verificam ownership do projeto. Ausência de autenticação retorna 401; projeto não pertencente ao usuário ou trace ausente retorna 404; filtros inválidos retornam 400.

| Endpoint                                       | Resposta                                                     |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `GET /api/projects/:projectId/services`        | Serviços descobertos, com ID, nome e environmentId           |
| `GET /api/projects/:projectId/traces`          | items, summary, operations, series, page, pageSize, from, to |
| `GET /api/projects/:projectId/traces/:traceId` | Trace, environment, spans, contagem e indicador truncated    |

Filtros: `from`, `to` (ISO 8601); `environmentId`, `serviceId` (UUID); `status` (`OK`, `ERROR`, `UNSET`); `operation` (trecho literal da operação raiz, sem distinção de caixa); `minDurationMs` (0 a 86.400.000); `sort` (`recent`, `slowest`); `page` (1 a 1.000).

Sem período explícito, a consulta usa as últimas 24 horas. O intervalo é `[from, to)`, crescente e limitado a 31 dias. Datas sem offset vindas do formulário são convertidas do horário de São Paulo para instantes ISO antes de consultar a API. A ordenação desempata por início e ID para manter paginação determinística. Resultados podem mudar durante ingestão concorrente; não há snapshot persistente entre páginas.

## Semântica dos indicadores

Os indicadores representam traces, não requisições HTTP nem spans individuais. Um trace com status `ERROR` entra no numerador da taxa de erro; `UNSET` continua distinguível de `OK`. Percentis representam a duração total armazenada do trace e são calculados sobre todos os registros filtrados, antes de paginar. O filtro de serviço inclui traces com pelo menos um span desse serviço (`EXISTS`), sem multiplicar registros em joins.

O PostgreSQL calcula os percentis por interpolação usando `percentile_cont`. Resultados vazios retornam percentis nulos, exibidos como “—”. Consulte a [documentação oficial das agregações PostgreSQL](https://www.postgresql.org/docs/current/functions-aggregate.html).

As operações são agrupadas pelo nome da operação raiz no recorte escolhido; com múltiplos serviços selecionados, nomes iguais são agrupados. A série temporal usa 24 intervalos de igual duração, preenchidos com zero na apresentação quando não há registros.

## Waterfall e limites

O detalhe retorna no máximo 2.000 spans ordenados por início e span ID, informa a contagem total e sinaliza truncamento. Spans com pai ausente, autorreferência ou ciclo continuam visíveis. A travessia iterativa evita estouro de pilha; o recuo visual para hierarquias profundas é limitado. Barras são normalizadas e limitadas à extensão do trace. A posição usa datas JavaScript com precisão de milissegundo; duração numérica preserva três casas decimais do banco. Não há cálculo de tempo exclusivo nem inferência de causalidade além de parentSpanId.

Limites de consulta e de quantidade não são um benchmark de escala. A etapa 7 implementou retenção, quotas, timeouts e validou o índice de paginação com EXPLAIN; consulte [retenção e operação](retention-and-hardening.md). A UI não renova sessão automaticamente: a ação de renovação é explícita no login.

## Validação desta entrega

- Lint, typecheck, testes e build do workspace.
- Testes HTTP com NestJS/Supertest: validação, ownership negado antes de ler dados, autenticação real exigida, trace ausente, serialização e truncamento.
- Testes de SQL: parâmetros separados do texto SQL, filtros de ownership, serviço participante e agregação independente da paginação. Estes testes inspecionam consultas; não executam PostgreSQL.
- Testes do waterfall: hierarquia fora de ordem, ciclos, pais ausentes, duração zero, tempos fora da faixa e 2.000 níveis.
- Teste da origem do proxy: loopback, HTTPS, origem estrangeira e valores malformados.
- Navegador com API temporária de fixtures: redirecionamento ao login, envio de login, dashboard, filtro sem resultados, erro de API, seleção de span com erro e abertura de atributos. Layout inspecionado em largura estreita e desktop.

Não havia `.env` Neon neste checkout. Portanto, a execução real das agregações SQL, a sessão persistida no Neon e o fluxo SDK → Collector → ingestão → banco → dashboard não foram verificados nesta entrega. As fixtures foram usadas somente na validação local e não fazem parte da aplicação.

## Aceite integrado pendente

1. Configurar as conexões Neon e os segredos em `.env`, aplicar migrations e iniciar o ambiente conforme o README.
2. Cadastrar uma conta, criar um projeto e configurar sua Project Key na aplicação demonstrativa.
3. Executar os cenários rápido, lento, erro e pedido composto da demo.
4. Confirmar os traces no dashboard e conferir a hierarquia do pedido e os spans de erro.
5. Comparar percentis e contagens com uma consulta direta no branch Neon de teste, incluindo um recorte sem registros.
6. Confirmar que uma segunda conta não consegue consultar os endpoints do primeiro projeto.

O Next.js acessa cookies em Server Components pela API assíncrona, sem repassá-los em props: [documentação de cookies](https://nextjs.org/docs/app/api-reference/functions/cookies).

## Revisão de experiência — 19/10/2026

A interface agora se chama Observa e apresenta traces como “atividades” e spans como “etapas”. A visão geral prioriza quantidade, falhas e mediana do tempo de resposta, com atalhos de investigação. Filtros avançados e percentis ficam em detalhes expansíveis; nenhum indicador mudou de semântica. Os horários personalizados agora são interpretados em São Paulo, substituindo o formulário UTC descrito na entrega original. Datas absolutas nas URLs preservam o instante exato. IDs permanecem disponíveis no detalhe, sem ocupar a tabela principal. O waterfall abre com a primeira etapa com falha selecionada, ou a primeira etapa disponível.

A validação de 19/10 incluiu a API e o Neon reais em branch isolado e atividades sintéticas enviadas por OTLP/gRPC, além dos testes de consultas e filtros. Isso complementa o registro original de fixtures acima. O Collector via Docker não foi reexecutado nesta revisão.

## Correção da navegação

A barra lateral abre telas distintas com `view=overview`, `view=activities` e `view=project`, substituindo as âncoras da revisão inicial. O destaque acompanha a tela atual. O contexto de projeto, período, filtros e paginação permanece nos links; o detalhe retorna à lista de atividades. A configuração do projeto abre diretamente e não consulta traces, evitando depender da carga de telemetria. A troca de projeto mantém a tela e limpa filtros específicos do projeto anterior.

## Correção de Atualizar visão — 19/10/2026

O botão recalcula períodos relativos (1h/24h/7d) até o instante atual e consulta novamente a API mesmo quando a URL já está igual. A navegação entre telas e o retorno do detalhe continuam preservando o snapshot exato, mas agora mantêm também o modo de período para distinguir datas personalizadas de um preset. Um intervalo personalizado de exatamente 24 horas continua personalizado.

Campos vazios, duração mínima zero e a ordenação padrão `recent` não são enviados como filtros ativos. O contador de “Mais filtros” considera somente serviço, resultado, duração positiva e ordenação por maior duração. Filtros escolhidos são preservados na atualização; a página volta à primeira página de resultados. O botão anuncia o estado de atualização e impede envios repetidos enquanto a consulta está pendente.

A correção foi validada em Chromium no Docker: um trace novo gerado após abrir a tela apareceu ao clicar novamente no mesmo URL; filtros explícitos e datas personalizadas foram preservados e nenhum filtro extra foi ativado. A suíte web passou com 13 testes, além de lint, typecheck e build. A verificação real pode ser repetida com Observa no Docker e SQLVault na porta 3001:

```bash
pnpm --filter @tcc-observability/api exec node --env-file=/caminho/absoluto/observa/.env test/dashboard-refresh.integration.mjs
```

## Atividades legíveis — 20/10/2026

A lista e o waterfall agora usam nomes apresentados em português com rotas normalizadas e rótulos opcionais. O filtro de tipo separa navegação, requisições, erros e outras operações antes da paginação. O detalhe resume a atividade e apresenta tempos por camada com união de intervalos, preservando os dados técnicos em seções expansíveis. Configuração, privacidade, limites e evidências em [Nomes de atividades](activity-names.md).
