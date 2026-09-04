# Arquitetura

## Direção arquitetural

A solução separa apresentação, API administrativa e ingestão. O Next.js não contém regras de negócio nem acessa o Prisma. O NestJS expõe REST para o dashboard e, na porta interna `4319`, implementa o serviço OTLP/gRPC de traces.

## Componentes

### Dashboard

O App Router organiza páginas, layouts e estados de carregamento. Server Components são usados para leituras iniciais; componentes cliente ficam restritos a filtros, gráficos e interações. O dashboard consome contratos REST e nunca recebe credenciais privadas de ingestão.

### API REST

Organizada por módulos de domínio: autenticação, projetos, environments, project keys, services, traces, performance, erros e retenção. Todas as consultas de projeto incluem o usuário autenticado na condição de ownership.

### Ingestão

Dividida em quatro camadas:

1. transporte OTLP/gRPC;
2. autenticação e validação do lote;
3. processamento, normalização e sanitização;
4. persistência transacional e idempotente.

Essa fronteira impede que endpoints de alta frequência compartilhem controllers e serviços com as operações do dashboard.

### Collector

Recebe OTLP, limita uso de memória, agrupa lotes e aplica retry. Traces usam o exporter OTLP/gRPC apontado para a API interna. Metrics e logs continuam no exporter `debug`, preparados arquiteturalmente sem persistência prematura.

O metadata `x-obs-project-key` é preservado pelo receiver, usado como partição do batch e encaminhado pelo `headers_setter`. Essa separação impede misturar telemetria de projetos diferentes no mesmo lote autenticado.

### Banco

PostgreSQL é usado para dados administrativos e traces do MVP. O desenho privilegia demonstração funcional e consultas justificáveis academicamente, sem tentar reproduzir um armazenamento distribuído de observabilidade.

## Decisões

- `service.name`, environment e projeto definem a identidade de um serviço; URL não define serviço.
- OTLP permanece o protocolo entre SDK, Collector e ingestão.
- W3C Trace Context é o mecanismo de correlação entre browser e backend.
- Tracing é implementado primeiro; metrics e logs possuem pipelines reservados, sem persistência prematura.
- Agregações iniciais são calculadas sobre spans e traces com SQL correto, incluindo `percentile_cont`.
- O deployment Next.js usa runtime Node.js e saída standalone.

## Evolução do MVP

1. fundação;
2. banco e autenticação;
3. projetos e credenciais;
4. ingestão e persistência OTLP — concluída;
5. SDK Node e aplicação demonstrativa — concluída;
6. dashboard de tracing — implementado; validação integrada Neon/Collector pendente;
7. retenção e hardening;
8. browser SDK e correlação distribuída.

## Consultas de tracing

O módulo `TracingModule` separa controller REST, serviço de autorização e repositório. A autorização verifica ownership antes da leitura; as consultas SQL e Prisma também incluem projeto e usuário. Lista, percentis, operações e série temporal compartilham os mesmos filtros em uma transação `RepeatableRead`.

O Next.js lê via Server Components sem cache de dados privados. Formulários GET mantêm filtros compartilháveis. Componentes cliente ficam restritos a autenticação/criação de projeto e seleção de spans. Um proxy de POST com rotas permitidas encaminha cookies e respeita a origem da requisição no acesso direto ao Next.js.
