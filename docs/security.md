# Segurança

## Credenciais

- senhas: Argon2id;
- JWT de curta duração;
- sessões/refresh tokens revogáveis e armazenados por hash;
- Project Keys com alta entropia, prefixo consultável e HMAC-SHA-256 usando pepper;
- identificadores browser públicos sem privilégios administrativos.

## Dados proibidos

Authorization, cookies, senhas, tokens, connection strings, variáveis de ambiente, corpos HTTP e query strings não serão persistidos como atributos. Chaves sensíveis serão removidas por nome e por contexto semântico.

## Defesa em profundidade

- separação de metadata no Collector e sanitização defensiva na API;
- limite de payload no Nginx e no transporte;
- rate limit por IP e por projeto;
- validação de tamanho, quantidade e profundidade de atributos/eventos;
- quotas de cardinalidade;
- CORS restrito;
- ownership obrigatório em consultas REST;
- containers executados como usuário não privilegiado quando possível.

## Sessões JWT

Access e refresh tokens são enviados em cookies HttpOnly, `SameSite=Lax` e `Secure` em produção. O access token é curto. O refresh token está associado a uma sessão persistida somente por SHA-256, é rotacionado a cada renovação e sua reutilização revoga a sessão.

## Project Keys

Project Keys possuem 256 bits aleatórios e prefixo `obs_live_`. O banco recebe somente HMAC-SHA-256 com um pepper do servidor e um prefixo não secreto. A chave completa é retornada apenas na criação. Uma transação serializável impede a revogação da última chave ativa.

Na ingestão Node, a chave viaja no metadata `x-obs-project-key`. O Collector não a transforma em atributo: preserva o metadata, particiona o batch por chave e o encaminha à API interna. Chaves ausentes, revogadas ou com formato inválido recebem `UNAUTHENTICATED`.

O SDK Node aceita a Project Key somente na execução server-side. Sua configuração recusa URLs de exporter com usuário ou senha embutidos. A instrumentação PostgreSQL mantém `enhancedDatabaseReporting` desabilitado e a instrumentação HTTP não copia headers para spans. O app demonstrativo nunca envia a chave ao bundle do navegador.

## Sanitização de telemetria

A ingestão limita cada exportação a 2.000 spans, 64 atributos por objeto, arrays com 32 itens, profundidade quatro, strings com 2.048 caracteres e até 32 eventos/links por span. Bytes opacos não são persistidos. Chaves relacionadas a authorization, cookies, senhas, tokens, secrets, sessões, credenciais, connection strings e ambiente são descartadas. URLs perdem query string e fragmento, e segmentos numéricos/UUID são normalizados para `:id`.

## Browser

O identificador público não é segredo. Sua proteção depende de origens permitidas, quotas, sampling, rate limiting e validação. CORS controla navegadores, mas não impede clientes não-browser de enviar requisições.

## Logs internos

Logs da plataforma não devem registrar bodies OTLP completos nem credenciais. Erros operacionais usarão IDs internos de lote/projeto e contagens, evitando copiar atributos potencialmente sensíveis.
