import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateEnvironmentDto } from './dto/create-environment.dto.js';
import { EnvironmentsService } from './environments.service.js';

@Controller('projects/:projectId/environments')
@UseGuards(JwtAuthGuard)
export class EnvironmentsController {
  public constructor(
    private readonly environmentsService: EnvironmentsService,
  ) {}

  @Get()
  public list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.environmentsService.list(user.id, projectId);
  }

  @Post()
  public create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateEnvironmentDto,
  ) {
    return this.environmentsService.create(user.id, projectId, input);
  }
}
