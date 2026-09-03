import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
} from '@opentelemetry/api';

export interface TraceOperationOptions {
  attributes?: Attributes;
  kind?: SpanKind;
}

const tracer = trace.getTracer('@tcc-observability/node');

export function traceOperation<T>(
  name: string,
  operation: () => Promise<T> | T,
  options: TraceOperationOptions = {},
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    {
      attributes: options.attributes,
      kind: options.kind ?? SpanKind.INTERNAL,
    },
    async (span) => {
      try {
        const result = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
