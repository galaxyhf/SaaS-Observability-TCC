import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { AccessTokenPayload, AuthenticatedUser } from './auth.types.js';
import { accessTokenFromRequest } from './request-token.js';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  public constructor(private readonly jwtService: JwtService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = accessTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Autenticação necessária.');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (
        payload.type !== 'access' ||
        !payload.sub ||
        !payload.email ||
        !payload.name
      ) {
        throw new Error('Invalid access payload');
      }

      request.user = {
        email: payload.email,
        id: payload.sub,
        name: payload.name,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
