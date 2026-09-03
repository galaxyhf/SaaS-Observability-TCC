import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { clearAuthCookies, setAuthCookies } from './auth.cookies.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { refreshTokenFromRequest } from './request-token.js';

interface AuthResponse {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  public async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const tokens = await this.authService.register(input);
    setAuthCookies(response, this.configService, tokens);
    return { user: tokens.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  public async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const tokens = await this.authService.login(input);
    setAuthCookies(response, this.configService, tokens);
    return { user: tokens.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  public async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const refreshToken = refreshTokenFromRequest(request);
    const tokens = await this.authService.refresh(refreshToken ?? '');
    setAuthCookies(response, this.configService, tokens);
    return { user: tokens.user };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  public async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(refreshTokenFromRequest(request));
    clearAuthCookies(response, this.configService);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  public me(@CurrentUser() user: AuthenticatedUser): AuthResponse {
    return { user };
  }
}
