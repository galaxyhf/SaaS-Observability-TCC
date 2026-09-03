import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  public constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  public create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, input);
  }

  @Get()
  public list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.list(user.id);
  }

  @Get(':projectId')
  public get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.projectsService.get(user.id, projectId);
  }

  @Get(':projectId/keys')
  public listKeys(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.projectsService.listKeys(user.id, projectId);
  }

  @Post(':projectId/keys')
  public createKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.projectsService.createKey(user.id, projectId);
  }

  @Delete(':projectId/keys/:keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  public revokeKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('keyId', new ParseUUIDPipe()) keyId: string,
  ): Promise<void> {
    return this.projectsService.revokeKey(user.id, projectId, keyId);
  }
}
