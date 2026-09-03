import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EnvironmentsModule } from './environments/environments.module.js';
import { HealthModule } from './health/health.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { SecurityModule } from './security/security.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SecurityModule,
    AuthModule,
    ProjectsModule,
    EnvironmentsModule,
    IngestionModule,
    HealthModule,
  ],
})
export class AppModule {}
