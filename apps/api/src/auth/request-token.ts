import type { Request } from 'express';

import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.cookies.js';

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

export function accessTokenFromRequest(
  request: RequestWithCookies,
): string | null {
  const authorization = request.header('authorization');

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim() || null;
  }

  return request.cookies?.[ACCESS_COOKIE] ?? null;
}

export function refreshTokenFromRequest(
  request: RequestWithCookies,
): string | undefined {
  return request.cookies?.[REFRESH_COOKIE];
}
