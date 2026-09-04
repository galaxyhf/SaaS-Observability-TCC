import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';

export class TraceQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) public from?: string;
  @IsOptional() @IsISO8601({ strict: true }) public to?: string;
  @IsOptional() @IsUUID() public environmentId?: string;
  @IsOptional() @IsUUID() public serviceId?: string;
  @IsOptional() @IsIn(['OK', 'ERROR', 'UNSET']) public status?: string;
  @IsOptional() @IsString() @MaxLength(512) public operation?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(86400000)
  public minDurationMs?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) public page = 1;
  @IsOptional() @IsIn(['recent', 'slowest']) public sort: 'recent' | 'slowest' =
    'recent';
}

export function queryPeriod(query: TraceQueryDto, now = new Date()) {
  const to = query.to ? new Date(withTimezone(query.to)) : now;
  const from = query.from
    ? new Date(withTimezone(query.from))
    : new Date(to.getTime() - 86400000);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to ||
    to.getTime() - from.getTime() > 31 * 86400000
  ) {
    throw new BadRequestException(
      'Informe um período crescente de até 31 dias.',
    );
  }
  return { from, to };
}

function withTimezone(value: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
}
