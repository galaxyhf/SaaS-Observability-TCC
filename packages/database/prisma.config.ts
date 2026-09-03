import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export default defineConfig({
  migrations: {
    path: 'prisma/migrations',
  },
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL_UNPOOLED'),
  },
});
