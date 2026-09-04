import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TracingController } from './tracing.controller.js';
import { TracingRepository } from './tracing.repository.js';
import { TracingService } from './tracing.service.js';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [TracingController],
  providers: [TracingRepository, TracingService],
})
export class TracingModule {}
