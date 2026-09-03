/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  rootDir: '.',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*-spec.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            decorators: true,
            syntax: 'typescript',
          },
          target: 'es2022',
          transform: {
            decoratorMetadata: true,
            legacyDecorator: true,
          },
        },
        module: { type: 'es6' },
      },
    ],
  },
};
