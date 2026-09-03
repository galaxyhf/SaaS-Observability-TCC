import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsRepository } from './projects.repository.js';
import { ProjectsService } from './projects.service.js';

@Module({
  controllers: [ProjectsController],
  exports: [ProjectsService],
  imports: [AuthModule],
  providers: [ProjectsRepository, ProjectsService],
})
export class ProjectsModule {}
