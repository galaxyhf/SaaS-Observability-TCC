import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import type { AuthTokens } from './auth.types.js';

export const ACCESS_COOKIE = 'obs_access';
export const REFRESH_COOKIE = 'obs_refresh';

function baseCookieOptions(configService: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: configService.get<string>('NODE_ENV') === 'production',
  };
}

export function setAuthCookies(
  response: Response,
  configService: ConfigService,
  tokens: AuthTokens,
): void {
  const accessTtl = configService.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
  const refreshDays = configService.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');

  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions(configService),
    maxAge: accessTtl * 1000,
    path: '/',
  });
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions(configService),
    maxAge: refreshDays * 86_400_000,
    path: '/api/auth',
  });
}

export function clearAuthCookies(
  response: Response,
  configService: ConfigService,
): void {
  response.clearCookie(ACCESS_COOKIE, {
    ...baseCookieOptions(configService),
    path: '/',
  });
  response.clearCookie(REFRESH_COOKIE, {
    ...baseCookieOptions(configService),
    path: '/api/auth',
  });
}
