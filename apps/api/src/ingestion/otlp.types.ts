export type OtlpLong = number | string | { toString(): string };

export interface OtlpAnyValue {
  arrayValue?: { values?: OtlpAnyValue[] };
  boolValue?: boolean;
  bytesValue?: Buffer | Uint8Array;
  doubleValue?: number;
  intValue?: OtlpLong;
  kvlistValue?: { values?: OtlpKeyValue[] };
  stringValue?: string;
}

export interface OtlpKeyValue {
  key?: string;
  value?: OtlpAnyValue;
}

export interface OtlpEvent {
  attributes?: OtlpKeyValue[];
  name?: string;
  timeUnixNano?: OtlpLong;
}

export interface OtlpLink {
  attributes?: OtlpKeyValue[];
  flags?: number;
  spanId?: Buffer | Uint8Array;
  traceId?: Buffer | Uint8Array;
  traceState?: string;
}

export interface OtlpSpan {
  attributes?: OtlpKeyValue[];
  endTimeUnixNano?: OtlpLong;
  events?: OtlpEvent[];
  flags?: number;
  kind?: number;
  links?: OtlpLink[];
  name?: string;
  parentSpanId?: Buffer | Uint8Array;
  spanId?: Buffer | Uint8Array;
  startTimeUnixNano?: OtlpLong;
  status?: { code?: number; message?: string };
  traceId?: Buffer | Uint8Array;
  traceState?: string;
}

export interface OtlpScopeSpans {
  scope?: { name?: string; version?: string };
  spans?: OtlpSpan[];
}

export interface OtlpResourceSpans {
  resource?: { attributes?: OtlpKeyValue[] };
  scopeSpans?: OtlpScopeSpans[];
}

export interface ExportTraceServiceRequest {
  resourceSpans?: OtlpResourceSpans[];
}

export interface ExportTraceServiceResponse {
  partialSuccess?: {
    errorMessage: string;
    rejectedSpans: string;
  };
}

export type SafeJson =
  boolean | number | string | null | SafeJson[] | { [key: string]: SafeJson };

export interface NormalizedSpan {
  attributes: Record<string, SafeJson>;
  durationMs: string;
  endedAt: Date;
  environmentName: string;
  environmentSlug: string;
  events: SafeJson[];
  flags: number;
  kind:
    'UNSPECIFIED' | 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  links: SafeJson[];
  name: string;
  parentSpanId: string | null;
  resourceAttributes: Record<string, SafeJson>;
  scopeName: string | null;
  scopeVersion: string | null;
  serviceName: string;
  serviceType: 'BROWSER' | 'SERVER' | 'UNKNOWN';
  spanId: string;
  startedAt: Date;
  statusCode: 'UNSET' | 'OK' | 'ERROR';
  statusMessage: string | null;
  traceId: string;
  traceState: string | null;
}

export interface MappingResult {
  rejectedSpans: number;
  spans: NormalizedSpan[];
  warnings: string[];
}
