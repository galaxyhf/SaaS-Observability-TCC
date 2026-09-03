import { Injectable } from '@nestjs/common';

import { createSlug } from '../projects/slug.js';
import type {
  ExportTraceServiceRequest,
  MappingResult,
  NormalizedSpan,
  OtlpEvent,
  OtlpLink,
  OtlpLong,
  OtlpResourceSpans,
  OtlpSpan,
  SafeJson,
} from './otlp.types.js';
import {
  normalizeOperationName,
  TelemetrySanitizer,
} from './telemetry-sanitizer.js';

const MAX_SPANS_PER_EXPORT = 2_000;
const MAX_EVENTS = 32;
const MAX_LINKS = 32;

function bytesToHex(value: Buffer | Uint8Array | undefined): string {
  return value ? Buffer.from(value).toString('hex') : '';
}

function requiredId(
  value: Buffer | Uint8Array | undefined,
  bytes: number,
  field: string,
): string {
  const result = bytesToHex(value);
  if (result.length !== bytes * 2 || /^0+$/.test(result)) {
    throw new Error(`${field} inválido.`);
  }
  return result;
}

function nanoseconds(value: OtlpLong | undefined, field: string): bigint {
  try {
    const result = BigInt(value?.toString() ?? '0');
    if (result <= 0n) {
      throw new Error();
    }
    return result;
  } catch {
    throw new Error(`${field} inválido.`);
  }
}

function nanosecondsToDate(value: bigint): Date {
  return new Date(Number(value / 1_000_000n));
}

function durationMilliseconds(start: bigint, end: bigint): string {
  if (end < start) {
    throw new Error('O fim do span é anterior ao início.');
  }
  const nanos = end - start;
  const whole = nanos / 1_000_000n;
  const fraction = (nanos % 1_000_000n) / 1_000n;
  return `${whole}.${fraction.toString().padStart(3, '0')}`;
}

function stringAttribute(
  values: Record<string, SafeJson>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function mapKind(kind = 0): NormalizedSpan['kind'] {
  return ([
    'UNSPECIFIED',
    'INTERNAL',
    'SERVER',
    'CLIENT',
    'PRODUCER',
    'CONSUMER',
  ][kind] ?? 'UNSPECIFIED') as NormalizedSpan['kind'];
}

function mapStatus(code = 0): NormalizedSpan['statusCode'] {
  return (['UNSET', 'OK', 'ERROR'][code] ??
    'UNSET') as NormalizedSpan['statusCode'];
}

function serviceType(
  attributes: Record<string, SafeJson>,
): NormalizedSpan['serviceType'] {
  const explicit = stringAttribute(
    attributes,
    'obs.service.type',
  )?.toLowerCase();
  if (explicit === 'browser') return 'BROWSER';
  if (explicit === 'server') return 'SERVER';
  const language = stringAttribute(
    attributes,
    'telemetry.sdk.language',
  )?.toLowerCase();
  return language === 'webjs' ? 'BROWSER' : language ? 'SERVER' : 'UNKNOWN';
}

@Injectable()
export class OtlpMapper {
  public constructor(private readonly sanitizer: TelemetrySanitizer) {}

  public map(request: ExportTraceServiceRequest): MappingResult {
    const result: MappingResult = { rejectedSpans: 0, spans: [], warnings: [] };
    let seen = 0;

    for (const resourceSpans of request.resourceSpans ?? []) {
      for (const scopeSpans of resourceSpans.scopeSpans ?? []) {
        for (const span of scopeSpans.spans ?? []) {
          seen += 1;
          if (seen > MAX_SPANS_PER_EXPORT) {
            result.rejectedSpans += 1;
            continue;
          }
          try {
            result.spans.push(
              this.mapSpan(resourceSpans, span, {
                name: scopeSpans.scope?.name,
                version: scopeSpans.scope?.version,
              }),
            );
          } catch (error) {
            result.rejectedSpans += 1;
            if (result.warnings.length < 5 && error instanceof Error) {
              result.warnings.push(error.message);
            }
          }
        }
      }
    }

    if (seen > MAX_SPANS_PER_EXPORT) {
      result.warnings.push(
        `O limite de ${MAX_SPANS_PER_EXPORT} spans por exportação foi excedido.`,
      );
    }
    return result;
  }

  private mapSpan(
    resourceSpans: OtlpResourceSpans,
    span: OtlpSpan,
    scope: { name?: string; version?: string },
  ): NormalizedSpan {
    const resourceAttributes = this.sanitizer.attributes(
      resourceSpans.resource?.attributes,
    );
    const serviceName = stringAttribute(
      resourceAttributes,
      'service.name',
    )?.slice(0, 255);
    if (!serviceName) {
      throw new Error('O atributo resource service.name é obrigatório.');
    }
    const environmentName = (
      stringAttribute(
        resourceAttributes,
        'deployment.environment.name',
        'deployment.environment',
      ) ?? 'production'
    ).slice(0, 80);
    const start = nanoseconds(span.startTimeUnixNano, 'start_time_unix_nano');
    const end = nanoseconds(span.endTimeUnixNano, 'end_time_unix_nano');

    return {
      attributes: this.sanitizer.attributes(span.attributes),
      durationMs: durationMilliseconds(start, end),
      endedAt: nanosecondsToDate(end),
      environmentName,
      environmentSlug: createSlug(environmentName).slice(0, 100),
      events: (span.events ?? [])
        .slice(0, MAX_EVENTS)
        .map((event) => this.event(event)),
      flags: span.flags ?? 0,
      kind: mapKind(span.kind),
      links: (span.links ?? [])
        .slice(0, MAX_LINKS)
        .map((link) => this.link(link)),
      name: normalizeOperationName(span.name || 'unknown'),
      parentSpanId: bytesToHex(span.parentSpanId) || null,
      resourceAttributes,
      scopeName: scope.name?.slice(0, 255) || null,
      scopeVersion: scope.version?.slice(0, 80) || null,
      serviceName,
      serviceType: serviceType(resourceAttributes),
      spanId: requiredId(span.spanId, 8, 'span_id'),
      startedAt: nanosecondsToDate(start),
      statusCode: mapStatus(span.status?.code),
      statusMessage: span.status?.message?.slice(0, 2_048) || null,
      traceId: requiredId(span.traceId, 16, 'trace_id'),
      traceState: span.traceState?.slice(0, 512) || null,
    };
  }

  private event(event: OtlpEvent): SafeJson {
    const timestamp = nanoseconds(event.timeUnixNano, 'event.time_unix_nano');
    return {
      attributes: this.sanitizer.attributes(event.attributes),
      name: (event.name || 'event').slice(0, 255),
      timestamp: nanosecondsToDate(timestamp).toISOString(),
    };
  }

  private link(link: OtlpLink): SafeJson {
    return {
      attributes: this.sanitizer.attributes(link.attributes),
      flags: link.flags ?? 0,
      spanId: requiredId(link.spanId, 8, 'link.span_id'),
      traceId: requiredId(link.traceId, 16, 'link.trace_id'),
      traceState: link.traceState?.slice(0, 512) || '',
    };
  }
}
