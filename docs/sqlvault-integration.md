# Integração real: SQLVault

Em 19/10/2026 o SQLVault foi conectado ao Observa local como projeto próprio. O site e o editor foram preservados; foram adicionados somente hooks de instrumentação, dependências, configuração de build e documentação.

- Aplicação: `http://localhost:3001`.
- Serviços: `sqlvault-browser` e `sqlvault-server`.
- Ambiente: `development`.
- Ingestão browser: Nginx → endpoint público com origens permitidas.
- Ingestão servidor: Collector OTLP/HTTP → ingestão gRPC → Neon.
- Credencial privada somente no `.env.local` do SQLVault, ignorado pelo Git.
- Pacotes privados empacotados em `vendor/observa` no repositório SQLVault, sem dependência de link local ou publicação no npm.

O servidor usa `privacyMode: 'strict'`. Antes de exportar, o SDK remove SQL, parâmetros, URLs, headers/bodies, mensagens/stacks de erros, eventos/links, tracestate e atributos extras de processo/host. Preserva somente tempos, IDs, tipo de banco, método/status HTTP, rotas normalizadas, rótulos estáticos configurados e identificação do serviço. Metrics e logs automáticos ficam desativados nesse modo. A instrumentação browser também filtra os dados antes da exportação.

## Evidência

Lint, typecheck e build do SQLVault passaram. O teste real em Chromium confirmou os serviços browser/server no mesmo trace, relação parent/child e visualização do waterfall. Um marcador usado como SQL/senha em um payload inválido não apareceu na telemetria e a chave privada não estava no bundle browser. A requisição foi rejeitada pela validação com HTTP 400; não foram executadas consultas de teste nem alterados dados do SQLVault.

```bash
# SQLVault compilado e rodando na porta 3001; Observa em Docker.
pnpm --filter @tcc-observability/api exec node --env-file=/caminho/absoluto/observa/.env test/sqlvault.integration.mjs
```

O teste usa o projeto público registrado no `.env.local` do SQLVault e a configuração administrativa local do Observa somente para verificar traces/dashboard. O JWT temporário tem validade de cinco minutos e não é salvo ou impresso. `SQLVAULT_TEST_PATH` permite informar outra localização do repositório.

O carregamento inicial do documento não compartilha automaticamente seu trace com a resposta HTML. Chamadas do browser ao Agent .NET podem ser medidas como requisições de rede, mas o Agent não foi instrumentado internamente e não recebe headers de propagação. Publicação em produção exige Collector/plataforma acessíveis por HTTPS e configuração da origem real do site; não foi realizada nesta instalação local.
