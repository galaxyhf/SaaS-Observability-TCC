interface AppEnvironment {
  API_PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_DAYS: number;
  JWT_SECRET: string;
  INGESTION_GRPC_PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  PROJECT_KEY_PEPPER: string;
  TRACE_RETENTION_DAYS: number;
}

const MINIMUM_SECRET_LENGTH = 32;

function requiredString(
  values: Record<string, unknown>,
  key: keyof AppEnvironment,
): string {
  const value = values[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`A variável de ambiente ${key} é obrigatória.`);
  }

  return value;
}

function secret(
  values: Record<string, unknown>,
  key: keyof AppEnvironment,
): string {
  const value = requiredString(values, key);

  if (value.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(
      `A variável de ambiente ${key} deve possuir pelo menos ${MINIMUM_SECRET_LENGTH} caracteres.`,
    );
  }

  return value;
}

function positiveInteger(
  values: Record<string, unknown>,
  key: keyof AppEnvironment,
  fallback: number,
): number {
  const raw = values[key] ?? fallback;
  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `A variável de ambiente ${key} deve ser um inteiro positivo.`,
    );
  }

  return value;
}

export function validateEnvironment(
  values: Record<string, unknown>,
): AppEnvironment {
  const nodeEnvironment = values.NODE_ENV ?? 'development';

  if (
    !['development', 'production', 'test'].includes(String(nodeEnvironment))
  ) {
    throw new Error('NODE_ENV deve ser development, production ou test.');
  }

  return {
    API_PORT: positiveInteger(values, 'API_PORT', 4000),
    DATABASE_URL: requiredString(values, 'DATABASE_URL'),
    INGESTION_GRPC_PORT: positiveInteger(values, 'INGESTION_GRPC_PORT', 4319),
    JWT_ACCESS_TTL_SECONDS: positiveInteger(
      values,
      'JWT_ACCESS_TTL_SECONDS',
      900,
    ),
    JWT_REFRESH_TTL_DAYS: positiveInteger(values, 'JWT_REFRESH_TTL_DAYS', 7),
    JWT_SECRET: secret(values, 'JWT_SECRET'),
    NODE_ENV: nodeEnvironment as AppEnvironment['NODE_ENV'],
    PROJECT_KEY_PEPPER: secret(values, 'PROJECT_KEY_PEPPER'),
    TRACE_RETENTION_DAYS: positiveInteger(values, 'TRACE_RETENTION_DAYS', 7),
  };
}
