import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { TraceQueryDto } from './trace-query.dto.js';
import { TracingService } from './tracing.service.js';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class TracingController {
  public constructor(private readonly tracing: TracingService) {}
  @Get('traces')
  public overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() query: TraceQueryDto,
  ) {
    return this.tracing.overview(user.id, projectId, query);
  }
  @Get('services')
  public services(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.tracing.services(user.id, projectId);
  }
  @Get('traces/:traceId')
  public detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('traceId') traceId: string,
  ) {
    if (!/^[a-f0-9]{32}$/.test(traceId))
      throw new BadRequestException('Trace ID inválido.');
    return this.tracing.detail(user.id, projectId, traceId);
  }
}
