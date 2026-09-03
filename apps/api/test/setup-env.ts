process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://test:test@ep-test-pooler.us-east-2.aws.neon.tech/test?sslmode=require';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.PROJECT_KEY_PEPPER =
  'test-project-key-pepper-with-at-least-32-characters';
