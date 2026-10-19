import { Module } from '@nestjs/common';
import { RetentionRepository } from './retention.repository.js';
import { RetentionService } from './retention.service.js';
@Module({ providers: [RetentionRepository, RetentionService] })
export class RetentionModule {}
