import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment, ProjectKey } from '@tcc-observability/database';

import type { CreateProjectDto } from './dto/create-project.dto.js';
import {
  generateProjectKey,
  generatePublicProjectId,
} from './project-key.crypto.js';
import {
  ProjectsRepository,
  type ProjectWithEnvironments,
} from './projects.repository.js';
import { createSlug } from './slug.js';

export interface ProjectView {
  createdAt: Date;
  environments: Environment[];
  id: string;
  name: string;
  publicId: string;
  retentionDays: number;
  slug: string;
  updatedAt: Date;
  websiteUrl: string | null;
}

export interface CreatedProjectView extends ProjectView {
  projectKey: string;
}

export interface ProjectKeyView {
  createdAt: Date;
  id: string;
  lastUsedAt: Date | null;
  prefix: string;
  revokedAt: Date | null;
}

export interface CreatedProjectKeyView extends ProjectKeyView {
  key: string;
}

@Injectable()
export class ProjectsService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly projectsRepository: ProjectsRepository,
  ) {}

  public async create(
    userId: string,
    input: CreateProjectDto,
  ): Promise<CreatedProjectView> {
    const pepper = this.configService.getOrThrow<string>('PROJECT_KEY_PEPPER');
    const generatedKey = generateProjectKey(pepper);
    const project = await this.projectsRepository.createWithDefaults({
      keyHash: generatedKey.keyHash,
      keyPrefix: generatedKey.prefix,
      name: input.name,
      publicId: generatePublicProjectId(),
      retentionDays: this.configService.getOrThrow<number>(
        'TRACE_RETENTION_DAYS',
      ),
      slug: await this.availableSlug(userId, input.name),
      userId,
      websiteUrl: input.websiteUrl,
    });

    return { ...this.toProjectView(project), projectKey: generatedKey.key };
  }

  public async list(userId: string): Promise<ProjectView[]> {
    const projects = await this.projectsRepository.list(userId);
    return projects.map((project) => this.toProjectView(project));
  }

  public async get(userId: string, projectId: string): Promise<ProjectView> {
    return this.toProjectView(
      await this.requireOwnedProject(userId, projectId),
    );
  }

  public async listKeys(
    userId: string,
    projectId: string,
  ): Promise<ProjectKeyView[]> {
    await this.requireOwnedProject(userId, projectId);
    const keys = await this.projectsRepository.listKeys(projectId);
    return keys.map((key) => this.toProjectKeyView(key));
  }

  public async createKey(
    userId: string,
    projectId: string,
  ): Promise<CreatedProjectKeyView> {
    await this.requireOwnedProject(userId, projectId);
    const generatedKey = generateProjectKey(
      this.configService.getOrThrow<string>('PROJECT_KEY_PEPPER'),
    );
    const key = await this.projectsRepository.createKey({
      keyHash: generatedKey.keyHash,
      prefix: generatedKey.prefix,
      projectId,
    });

    return { ...this.toProjectKeyView(key), key: generatedKey.key };
  }

  public async revokeKey(
    userId: string,
    projectId: string,
    keyId: string,
  ): Promise<void> {
    await this.requireOwnedProject(userId, projectId);
    const result = await this.projectsRepository.revokeKeySafely(
      projectId,
      keyId,
    );

    if (result === 'last-active') {
      throw new BadRequestException(
        'Crie uma nova Project Key antes de revogar a última chave ativa.',
      );
    }

    if (result === 'not-found') {
      throw new NotFoundException('Project Key ativa não encontrada.');
    }
  }

  public async requireOwnedProject(
    userId: string,
    projectId: string,
  ): Promise<ProjectWithEnvironments> {
    const project = await this.projectsRepository.findOwnedById(
      userId,
      projectId,
    );

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    return project;
  }

  private async availableSlug(userId: string, name: string): Promise<string> {
    const baseSlug = createSlug(name);

    if (!(await this.projectsRepository.slugExists(userId, baseSlug))) {
      return baseSlug;
    }

    return `${baseSlug}-${randomBytes(3).toString('hex')}`;
  }

  private toProjectView(project: ProjectWithEnvironments): ProjectView {
    return {
      createdAt: project.createdAt,
      environments: project.environments,
      id: project.id,
      name: project.name,
      publicId: project.publicId,
      retentionDays: project.retentionDays,
      slug: project.slug,
      updatedAt: project.updatedAt,
      websiteUrl: project.websiteUrl,
    };
  }

  private toProjectKeyView(key: ProjectKey): ProjectKeyView {
    return {
      createdAt: key.createdAt,
      id: key.id,
      lastUsedAt: key.lastUsedAt,
      prefix: key.prefix,
      revokedAt: key.revokedAt,
    };
  }
}
