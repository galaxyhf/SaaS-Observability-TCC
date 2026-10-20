# Atividades compreensíveis

Os SDKs browser e Node reconhecem rotas antes da exportação. O dashboard descreve métodos HTTP sem presumir a intenção de negócio: `GET /api/products/:id` vira “Buscar /api/products/:id”; `POST /api/orders` vira “Enviar para /api/orders”.

## Configuração opcional em qualquer projeto

Use a mesma opção em `initObservability` no browser e no servidor:

```ts
routes: [
  { path: '/api/orders', method: 'POST', label: 'Finalizar compra' },
  { path: '/api/invoices/:id', method: 'GET', label: 'Consultar fatura' },
  { path: '/reports', label: 'Abrir relatórios' },
];
```

As rotas aceitam segmentos estáticos, parâmetros `:id` e `*` para um segmento. A primeira correspondência ganha; coloque regras específicas antes das gerais. O método é opcional. Rótulos são texto estático definido pelo desenvolvedor, nunca conteúdo da requisição. Não coloque nomes, tokens ou informações pessoais em templates ou rótulos.

Sem configuração, o SDK preserva somente um vocabulário público de segmentos comuns (como `api`, `users`, `products`, `dashboard`) e substitui qualquer outro segmento por `:id`. Isso cobre números, UUIDs, emails e tokens opacos, inclusive os curtos. Rotas específicas de cada aplicação exigem um template para preservar seus segmentos estáticos desconhecidos. Query, fragmento, host e credenciais não entram no nome da atividade. O modo estrito Node continua removendo SQL, mensagens de erro, bodies, headers e eventos.

Navegações registram mudanças de pathname; alterações só de query/hash e replaceState para a mesma página não geram navegações duplicadas. Requisições Next com `_rsc` e recursos `/_next/` recebem identificação de atualização interna. A instrumentação não afirma qual clique originou uma requisição.

## Leitura no dashboard

- A lista distingue Navegação, Requisições, Erros e Outras operações. O filtro por tipo atua na API, antes da paginação e das agregações. Erros têm prioridade sobre o tipo original.
- A busca aceita o nome técnico original ou o rótulo configurado.
- O detalhe explica a natureza da atividade, apresenta código HTTP quando recebido e identifica presença de etapas de servidor e banco. Status ausente não vira sucesso.
- “Onde o tempo foi gasto” mostra a união dos intervalos de cada camada, limitada ao intervalo da atividade. Etapas aninhadas ou paralelas da mesma camada não são contadas duas vezes. Camadas se sobrepõem: os valores não devem ser somados e não representam tempo exclusivo de CPU ou rede.
- Ausência de spans é “Sem etapas recebidas”, nunca zero. Traces truncados sinalizam cálculo parcial. Serviço original, IDs, nomes e JSON permanecem nos detalhes técnicos expansíveis.

Dados antigos que perderam rotas na exportação continuam genéricos; não é possível reconstruir a rota original. Atualize os SDKs e reconstrua a aplicação instrumentada para receber os novos metadados. Não há alteração de schema.

## SQLVault

Os hooks de instrumentação recebem rótulos para painel, editor, Agent e a rota `/api/sql-editor`. Esta última aparece como “Solicitação ao editor SQL”, pois a mesma rota atende múltiplas ações e não se deve chamar toda requisição de “Executar consulta”. Interface, rotas funcionais e comportamento do editor permanecem preservados. O Agent .NET ainda não possui instrumentação interna.

## Validação local — 20/10/2026

Lint, typecheck e builds passaram. As suítes somam 81 testes aprovados, cobrindo rotas, privacidade, união de intervalos, filtros, autorização e consultas parametrizadas. O Chromium confirmou exportação OTLP com metadados novos e sem valores privados.

O fluxo SQLVault → Nginx/Collector → API/Neon → dashboard passou com uma requisição inválida HTTP 400, rejeitada antes de executar SQL. Rota e rótulo apareceram na lista e no detalhe, navegador e servidor foram correlacionados e o filtro respeitou a prioridade de erros. A tela foi inspecionada em desktop e em 390 px sem overflow da página. O teste de atualização de visão também passou, incluindo novas atividades no mesmo URL, filtros explícitos e datas personalizadas.

Reprodução: `node --env-file=../../.env test/sqlvault.integration.mjs` e `node --env-file=../../.env test/dashboard-refresh.integration.mjs`, executados em `apps/api`, com o Observa no Docker e SQLVault na porta 3001. Os testes geram telemetria local; não publicam a aplicação.
