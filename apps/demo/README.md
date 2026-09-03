# Aplicação demonstrativa

Aplicação Next.js usada para gerar telemetria controlada durante a apresentação do TCC.

## Configuração

1. Crie uma conta e um projeto na plataforma.
2. Copie a Project Key exibida uma única vez.
3. Defina `DEMO_OBS_PROJECT_KEY` no `.env` da raiz.
4. Inicie ou recrie o serviço demo para que a variável seja carregada.

Com Docker:

```bash
docker compose up --build
```

Acesse `http://localhost:3100`. A demonstração usa uma conexão pooled de um banco Neon separado do banco da plataforma.

Sem Docker, defina as variáveis abaixo e execute `pnpm --filter @tcc-observability/demo dev`:

```dotenv
OBS_PROJECT_KEY=obs_live_sua_chave_privada
OBS_SERVICE_NAME=demo-store-server
OBS_ENVIRONMENT=development
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
DEMO_DATABASE_URL=postgresql://USUARIO:SENHA@ep-demo-pooler.REGIAO.aws.neon.tech/demo?sslmode=require
```

## Cenários

| Endpoint            | Evidência gerada                                             |
| ------------------- | ------------------------------------------------------------ |
| `GET /api/fast`     | requisição rápida                                            |
| `GET /api/slow`     | latência intencional de 900 ms                               |
| `GET /api/error`    | exceção e resposta HTTP 500                                  |
| `GET /api/database` | operação PostgreSQL auto-instrumentada                       |
| `POST /api/order`   | spans filhos de validação, estoque, pagamento e persistência |

O app também funciona sem `OBS_PROJECT_KEY`, mas nesse modo não exporta traces. Essa tolerância permite subir a plataforma antes de criar o primeiro projeto; após obter a chave, reinicie o serviço demo.
