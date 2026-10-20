# Etapa 8 — SDK browser e correlação distribuída

## Arquitetura

O browser usa identificador público `obs_pub_`; a Project Key `obs_live_` continua exclusiva do servidor. O SDK envia OTLP/HTTP protobuf para `POST /api/browser/:publicId/v1/traces`, passando pelo Nginx. Esse endpoint NestJS resolve o projeto e valida a origem antes de decodificar o lote, reutilizando mapper, sanitização, quotas persistentes e persistência idempotente. Não precisa criar uma chave privada intermediária nem expor o Collector para credenciais públicas.

O fluxo Node → Collector → ingestão gRPC permanece disponível. Browser e Node usam o mesmo projeto e `deployment.environment.name`, com nomes e tipos de serviço diferentes. A propagação W3C associa o span CLIENT de fetch/XHR ao span SERVER do backend, preservando trace ID e parent span ID. O dashboard existente agrupa ambos no mesmo waterfall.

Não há migration nova: `projects.public_id` e `project_allowed_origins` já estavam no schema inicial.

## Configurar um projeto

As rotas administrativas exigem JWT e ownership. Use o mesmo cookie de acesso do dashboard ou um bearer token válido:

```text
GET  /api/projects/:projectId/browser
POST /api/projects/:projectId/browser/origins
```

O GET retorna `publicId`, `endpointPath` e `origins`. O POST substitui a lista inteira:

```json
{ "origins": ["http://localhost:3100", "https://store.example.com"] }
```

São aceitas até 20 origens HTTP(S) exatas, sem wildcard, credenciais, caminhos, query, fragmento ou barra final. Uma lista vazia bloqueia toda ingestão browser. Não há origem liberada automaticamente pela URL do projeto.

Instale/inclua `@tcc-observability/browser` no workspace cliente e inicialize conforme o [README do SDK](../packages/browser/README.md). Configure o backend com a chave privada do mesmo projeto. Para um backend em outra origem, inclua sua origem em `propagateToOrigins` e permita `traceparent`/`tracestate` no CORS desse backend.

## Demonstração

Preencha no `.env` raiz o identificador público do projeto da demo, além da Project Key privada já usada no servidor:

```dotenv
NEXT_PUBLIC_OBS_PROJECT_ID=obs_pub_identificador_do_projeto
NEXT_PUBLIC_OBS_ENDPOINT=http://localhost
NEXT_PUBLIC_OBS_ENVIRONMENT=development
```

Autorize `http://localhost:3100` via POST de origens. Com acesso direto à API durante desenvolvimento, use `NEXT_PUBLIC_OBS_ENDPOINT=http://localhost:4000`. No Compose, use `http://localhost` (Nginx). O comando `dev` da demo carrega o `.env` raiz; para execução Node fora do Compose, o SDK servidor usa `OBS_PROJECT_KEY`, `OBS_ENVIRONMENT` e `OBS_SERVICE_NAME`. O Compose traduz as variáveis `DEMO_OBS_*` para esses nomes. Mantenha os ambientes browser/server iguais.

Os valores `NEXT_PUBLIC_*` são incorporados no build. O Dockerfile da demo recebe apenas essas três configurações públicas como build args; alterações exigem reconstruir a demo. A chave privada é fornecida somente no runtime do servidor. Execute os cenários rápido, lento, erro ou pedido e abra a atividade correspondente no dashboard: o waterfall deve conter o serviço browser e o serviço servidor.

## Segurança e limites

- Origin obrigatório e consultado na allowlist do projeto em cada preflight e POST. Origem ausente, desconhecida ou revogada recebe 403, sem liberar CORS. As respostas aprovadas retornam a origem exata e `Vary: Origin`, sem permitir credentials.
- Aceita somente `application/x-protobuf`, com limite de 1 MiB, e preserva o limite de 2.000 spans por exportação. A API força tipo BROWSER mesmo se o payload alegar ser servidor.
- Quota por projeto/minuto e limite de spans por trace são compartilhados com a ingestão privada. Excesso retorna HTTP 429; falhas de persistência retornam 503 sem detalhes do driver.
- Limite HTTP por endereço de conexão: 120 requisições/minuto por processo, incluindo preflights; atrás do proxy, clientes compartilham esse teto. Nginx também limita IP por zona OTLP. Não se confia em forwarded headers arbitrários.
- O identificador público não autentica um segredo. Origin/CORS restringem navegadores; clientes não-browser podem forjar Origin. Quotas, tamanho de payload, sanitização e cardinalidade são as proteções complementares.
- O SDK reduz os dados antes do envio: método, status, origem e rota normalizada, sem valores dinâmicos de caminhos, headers, query strings, mensagens de exceção ou bodies. Os limites e a sanitização do servidor permanecem ativos.

## Validação reproduzível

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @tcc-observability/browser exec playwright install chromium
pnpm --filter @tcc-observability/browser test:browser
```

O teste Chromium verifica fetch, XHR, propagação permitida e bloqueada, carregamento, navegação, erros, exportação protobuf e ausência de dados sensíveis. Os testes HTTP NestJS verificam preflight, rejeição de origem, payload inválido/grande, sanitização, preservação de IDs e tradução de quota para 429.

A integração real é opt-in e requer um branch Neon descartável. Nunca use o `.env` principal:

```bash
# Arquivo de teste fora do repositório:
# BROWSER_TEST_DATABASE_URL=<conexão do branch isolado>
# BROWSER_TEST_CONFIRM_ISOLATED=true
pnpm --filter @tcc-observability/api exec node --env-file=/caminho/teste.env test/browser.integration.mjs
```

O script cria uma conta/projeto próprios e os remove em `finally`. Ele executa Chromium e um servidor HTTP com o SDK Node automático, persiste o OTLP real de ambos e verifica junção, tipos de serviço, parent, idempotência, ownership e revogação de origem. Os spans Node passam pela autenticação privada e pelo serviço de ingestão. Isso comprova a correlação e o armazenamento reais, mas não substitui um teste do Collector/Nginx em containers ou um deploy de produção.

Em 19/10/2026, essa integração passou no branch descartável `codex-stage7-validation-20261019`, reutilizado da validação anterior. Somente os registros da conta de teste foram criados e removidos, sem alterar credenciais locais ou o banco principal.

## Validação Docker concluída — 19/10/2026

As imagens atuais de API, dashboard e demo foram reconstruídas. As migrations estavam aplicadas, os health checks passaram e `nginx -t` confirmou a configuração. A demo foi ligada ao identificador público do mesmo projeto da chave privada existente, com origem `http://localhost:3100` e ambiente alinhado.

O teste real em Chromium executou os cinco cenários pela interface e confirmou os cinco traces correlacionados através de Nginx, Collector, ingestão e Neon. Verificou também status ERROR no erro 500, duração mínima da operação lenta, span automático PostgreSQL e as cinco operações de domínio do pedido. O dashboard exibiu o waterfall do pedido com 12 spans, incluindo navegador, servidor e banco. Não houve erro de JavaScript no navegador.

Foi corrigida uma falha de instrumentação descoberta nessa validação: o webpack incorporava o SDK Node ao bundle do hook de inicialização, e o entrypoint ESM do `pg` não passava pelo hook CommonJS ativo. A demo agora externaliza explicitamente o SDK nessa camada e carrega SDK/driver como módulos nativos; o standalone inclui seus arquivos e plugins. O teste exige os spans SQL e detecta regressões desse comportamento.

Para repetir no Compose local já configurado, use o caminho absoluto do `.env`:

```bash
pnpm --filter @tcc-observability/api exec node --env-file=/caminho/absoluto/.env test/docker.integration.mjs
```

Esse teste usa o projeto da demo configurado no arquivo, gera telemetria real e cria um pedido demonstrativo. Ele não cria usuários nem altera a senha do proprietário; o acesso temporário de leitura ao dashboard usa JWT de cinco minutos derivado da configuração local. Não execute contra um ambiente sem autorização para gerar dados demonstrativos.

A opção `--configure` configura somente o identificador público, endpoint e ambiente da demo no `.env`, e adiciona a origem local sem remover outras origens. Depois dela, reconstrua a demo para incorporar as variáveis públicas. A chave privada existente é preservada. Esta evidência comprova o MVP no Docker local, sem representar um deploy de produção.
