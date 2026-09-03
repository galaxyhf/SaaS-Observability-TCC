import { Injectable } from '@nestjs/common';

import type { OtlpAnyValue, OtlpKeyValue, SafeJson } from './otlp.types.js';

const MAX_ATTRIBUTES = 64;
const MAX_ARRAY_ITEMS = 32;
const MAX_DEPTH = 4;
const MAX_KEY_LENGTH = 255;
const MAX_STRING_LENGTH = 2_048;

const SENSITIVE_KEY =
  /(^|[._-])(authorization|cookie|password|passwd|secret|token|api[._-]?key|session|credential|connection[._-]?string|env)([._-]|$)/i;
const URL_KEY = /(^|\.)(url\.full|http\.url|http\.target|url\.path)$/i;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const LONG_ID_SEGMENT = /^(?:\d{3,}|[0-9a-f]{16,})$/i;

function clamp(value: string, maximum = MAX_STRING_LENGTH): string {
  return value.slice(0, maximum);
}

function normalizePath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) =>
      UUID_SEGMENT.test(segment) || LONG_ID_SEGMENT.test(segment)
        ? ':id'
        : segment,
    )
    .join('/');
}

export function sanitizeUrl(value: string): string {
  try {
    const parsed = new URL(value, 'http://telemetry.local');
    const normalizedPath = normalizePath(parsed.pathname);
    return parsed.origin === 'http://telemetry.local'
      ? normalizedPath
      : `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  } catch {
    return normalizePath(value.split(/[?#]/, 1)[0] ?? '');
  }
}

export function normalizeOperationName(value: string): string {
  const trimmed = clamp(value.trim(), 512);
  const match = /^(?<method>[A-Z]+)\s+(?<target>\/?\S+)$/.exec(trimmed);

  if (!match?.groups) {
    return trimmed;
  }

  return `${match.groups.method ?? ''} ${sanitizeUrl(match.groups.target ?? '')}`.trim();
}

@Injectable()
export class TelemetrySanitizer {
  public attributes(
    values: OtlpKeyValue[] | undefined,
  ): Record<string, SafeJson> {
    const result: Record<string, SafeJson> = {};

    for (const item of (values ?? []).slice(0, MAX_ATTRIBUTES)) {
      const key = clamp(item.key?.trim() ?? '', MAX_KEY_LENGTH);

      if (!key || SENSITIVE_KEY.test(key)) {
        continue;
      }

      const value = this.anyValue(item.value, 0);
      if (value !== undefined) {
        result[key] =
          typeof value === 'string' && URL_KEY.test(key)
            ? sanitizeUrl(value)
            : value;
      }
    }

    return result;
  }

  private anyValue(
    value: OtlpAnyValue | undefined,
    depth: number,
  ): SafeJson | undefined {
    if (!value || depth >= MAX_DEPTH) {
      return undefined;
    }
    if (typeof value.stringValue === 'string') {
      return clamp(value.stringValue);
    }
    if (typeof value.boolValue === 'boolean') {
      return value.boolValue;
    }
    if (
      typeof value.doubleValue === 'number' &&
      Number.isFinite(value.doubleValue)
    ) {
      return value.doubleValue;
    }
    if (value.intValue !== undefined) {
      const raw = value.intValue.toString();
      const parsed = Number(raw);
      return Number.isSafeInteger(parsed) ? parsed : clamp(raw, 64);
    }
    if (value.arrayValue) {
      return (value.arrayValue.values ?? [])
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => this.anyValue(item, depth + 1))
        .filter((item): item is SafeJson => item !== undefined);
    }
    if (value.kvlistValue) {
      const entries = this.attributesAtDepth(
        value.kvlistValue.values,
        depth + 1,
      );
      return entries;
    }

    // Byte arrays commonly contain identifiers or opaque payloads and are not persisted.
    return undefined;
  }

  private attributesAtDepth(
    values: OtlpKeyValue[] | undefined,
    depth: number,
  ): Record<string, SafeJson> {
    const result: Record<string, SafeJson> = {};

    for (const item of (values ?? []).slice(0, MAX_ATTRIBUTES)) {
      const key = clamp(item.key?.trim() ?? '', MAX_KEY_LENGTH);
      if (!key || SENSITIVE_KEY.test(key)) {
        continue;
      }
      const value = this.anyValue(item.value, depth);
      if (value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }
}
