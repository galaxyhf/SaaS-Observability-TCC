import type { Config } from 'jest';

const config: Config = {
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^@tcc-observability/node$': '<rootDir>/../../packages/node/src/index.ts',
    '^@tcc-observability/node/trace-operation$':
      '<rootDir>/../../packages/node/src/trace-operation.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          target: 'es2022',
          transform: { react: { runtime: 'automatic' } },
        },
        module: { type: 'es6' },
      },
    ],
  },
};

export default config;
