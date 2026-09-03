import { ConflictException, Injectable } from '@nestjs/common';
import type { Environment } from '@tcc-observability/database';

import { ProjectsService } from '../projects/projects.service.js';
import { createSlug } from '../projects/slug.js';
import type { CreateEnvironmentDto } from './dto/create-environment.dto.js';
import { EnvironmentsRepository } from './environments.repository.js';

@Injectable()
export class EnvironmentsService {
  public constructor(
    private readonly environmentsRepository: EnvironmentsRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  public async list(userId: string, projectId: string): Promise<Environment[]> {
    await this.projectsService.requireOwnedProject(userId, projectId);
    return this.environmentsRepository.list(projectId);
  }

  public async create(
    userId: string,
    projectId: string,
    input: CreateEnvironmentDto,
  ): Promise<Environment> {
    await this.projectsService.requireOwnedProject(userId, projectId);
    const slug = createSlug(input.name);

    if (await this.environmentsRepository.slugExists(projectId, slug)) {
      throw new ConflictException('Já existe um environment com este nome.');
    }

    return this.environmentsRepository.create({
      name: input.name,
      projectId,
      slug,
    });
  }
}
