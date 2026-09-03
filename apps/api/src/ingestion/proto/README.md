# Definições OTLP

Os arquivos em `opentelemetry/` foram copiados sem alterações do release `v1.7.0` do repositório oficial [`open-telemetry/opentelemetry-proto`](https://github.com/open-telemetry/opentelemetry-proto/tree/v1.7.0), sob licença Apache-2.0.

Eles são carregados em runtime pelo transporte gRPC do NestJS. A aplicação implementa o serviço padrão `opentelemetry.proto.collector.trace.v1.TraceService`; não existe protocolo de telemetria proprietário entre o Collector e a ingestão.
