import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@tcc-observability/database';

import { isUniqueConstraintViolation } from '../database/prisma-errors.js';
import { PasswordService } from '../security/password.service.js';
import { hashToken, tokenHashesMatch } from '../security/token-hash.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthRepository } from './auth.repository.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  AuthTokens,
  RefreshTokenPayload,
} from './auth.types.js';

@Injectable()
export class AuthService {
  public constructor(
    private readonly authRepository: AuthRepository,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly usersRepository: UsersRepository,
  ) {}

  public async register(input: RegisterDto): Promise<AuthTokens> {
    const existingUser = await this.usersRepository.findByEmail(input.email);

    if (existingUser) {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }

    const passwordHash = await this.passwordService.hash(input.password);
    let user: User;

    try {
      user = await this.usersRepository.create({
        email: input.email,
        name: input.name,
        passwordHash,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Já existe uma conta com este e-mail.');
      }

      throw error;
    }

    return this.createSession(this.toAuthenticatedUser(user));
  }

  public async login(input: LoginDto): Promise<AuthTokens> {
    const user = await this.usersRepository.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const passwordMatches = await this.passwordService.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    return this.createSession(this.toAuthenticatedUser(user));
  }

  public async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.authRepository.findActiveSession(
      payload.sid,
      payload.sub,
    );

    if (!session) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    if (!tokenHashesMatch(session.refreshTokenHash, hashToken(refreshToken))) {
      await this.authRepository.revokeSession(session.id);
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    const user = await this.usersRepository.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.signTokens(authenticatedUser, session.id);

    await this.authRepository.rotateSession(
      session.id,
      hashToken(tokens.refreshToken),
      this.refreshExpiration(),
    );

    return { ...tokens, user: authenticatedUser };
  }

  public async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      const session = await this.authRepository.findActiveSession(
        payload.sid,
        payload.sub,
      );

      if (session) {
        await this.authRepository.revokeSession(session.id);
      }
    } catch {
      // Logout permanece idempotente mesmo para tokens expirados ou inválidos.
    }
  }

  private async createSession(user: AuthenticatedUser): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const tokens = await this.signTokens(user, sessionId);

    await this.authRepository.createSession({
      expiresAt: this.refreshExpiration(),
      id: sessionId,
      refreshTokenHash: hashToken(tokens.refreshToken),
      userId: user.id,
    });

    return { ...tokens, user };
  }

  private async signTokens(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<Omit<AuthTokens, 'user'>> {
    const accessPayload: AccessTokenPayload = {
      email: user.email,
      name: user.name,
      sub: user.id,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sid: sessionId,
      sub: user.id,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        expiresIn: this.configService.getOrThrow<number>(
          'JWT_ACCESS_TTL_SECONDS',
        ),
      }),
      this.jwtService.signAsync(refreshPayload, {
        expiresIn:
          this.configService.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') *
          86_400,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(token);

      if (payload.type !== 'refresh' || !payload.sid || !payload.sub) {
        throw new Error('Invalid refresh payload');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
  }

  private refreshExpiration(): Date {
    const days = this.configService.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    return new Date(Date.now() + days * 86_400_000);
  }

  private toAuthenticatedUser(user: {
    email: string;
    id: string;
    name: string;
  }): AuthenticatedUser {
    return { email: user.email, id: user.id, name: user.name };
  }
}
