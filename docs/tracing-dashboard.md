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

Sem período explícito, a consulta usa as últimas 24 horas. O intervalo é `[from, to)`, crescente e limitado a 31 dias. Datas sem offset vindas do formulário são interpretadas como UTC. A ordenação desempata por início e ID para manter paginação determinística. Resultados podem mudar durante ingestão concorrente; não há snapshot persistente entre páginas.

## Semântica dos indicadores

Os indicadores representam traces, não requisições HTTP nem spans individuais. Um trace com status `ERROR` entra no numerador da taxa de erro; `UNSET` continua distinguível de `OK`. Percentis representam a duração total armazenada do trace e são calculados sobre todos os registros filtrados, antes de paginar. O filtro de serviço inclui traces com pelo menos um span desse serviço (`EXISTS`), sem multiplicar registros em joins.

O PostgreSQL calcula os percentis por interpolação usando `percentile_cont`. Resultados vazios retornam percentis nulos, exibidos como “—”. Consulte a [documentação oficial das agregações PostgreSQL](https://www.postgresql.org/docs/current/functions-aggregate.html).

As operações são agrupadas pelo nome da operação raiz no recorte escolhido; com múltiplos serviços selecionados, nomes iguais são agrupados. A série temporal usa 24 intervalos de igual duração, preenchidos com zero na apresentação quando não há registros.

## Waterfall e limites

O detalhe retorna no máximo 2.000 spans ordenados por início e span ID, informa a contagem total e sinaliza truncamento. Spans com pai ausente, autorreferência ou ciclo continuam visíveis. A travessia iterativa evita estouro de pilha; o recuo visual para hierarquias profundas é limitado. Barras são normalizadas e limitadas à extensão do trace. A posição usa datas JavaScript com precisão de milissegundo; duração numérica preserva três casas decimais do banco. Não há cálculo de tempo exclusivo nem inferência de causalidade além de parentSpanId.

Limites de consulta e de quantidade não são um benchmark de escala. Retenção, otimização baseada em EXPLAIN e endurecimento operacional pertencem à etapa 7. A UI não renova sessão automaticamente: a ação de renovação é explícita no login.

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
