import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AUTH_PATTERNS,
  Role,
  type AuthContext,
  type AuthSession,
  type PublicUser,
} from '@tea/contracts';
import { ForwardAuth } from '../application/forward-auth';
import { LoginDto, RegisterDto } from './auth.dto';
import { Public, Roles, cookie, type AuthenticatedRequest } from './auth-policy';
import { clearSession, setSession } from './auth-cookies';
function context(request: AuthenticatedRequest): AuthContext {
  return {
    correlationId: String(request.id ?? 'unknown'),
    userAgent: request.headers['user-agent']?.slice(0, 256),
    ip: request.ip?.slice(0, 64),
  };
}
@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(@Inject(ForwardAuth) private readonly auth: ForwardAuth) {}
  @Public()
  @Post('register')
  async register(
    @Body() input: RegisterDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return setSession(
      response,
      await this.auth.execute<AuthSession>(AUTH_PATTERNS.register, {
        input,
        context: context(request),
      }),
    );
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return setSession(
      response,
      await this.auth.execute<AuthSession>(AUTH_PATTERNS.login, {
        input,
        context: context(request),
      }),
    );
  }
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      return setSession(
        response,
        await this.auth.execute<AuthSession>(AUTH_PATTERNS.refresh, {
          input: { token: cookie(request, 'tea_refresh') },
          context: context(request),
        }),
      );
    } catch (error) {
      clearSession(response);
      throw error;
    }
  }
  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      return await this.auth.execute<{ loggedOut: true }>(AUTH_PATTERNS.logout, {
        input: { token: cookie(request, 'tea_refresh') },
        context: context(request),
      });
    } finally {
      clearSession(response);
    }
  }
  @Get('me')
  @ApiCookieAuth('tea_access')
  me(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.execute<PublicUser>(AUTH_PATTERNS.me, {
      input: { userId: request.user!.sub },
      context: context(request),
    });
  }
}
@ApiTags('Administration')
@Roles(Role.ADMIN)
@Controller('api/v1/admin/auth')
export class AdminAuthController {
  constructor(@Inject(ForwardAuth) private readonly auth: ForwardAuth) {}
  @Get('me')
  @ApiCookieAuth('tea_access')
  me(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.execute<PublicUser>(AUTH_PATTERNS.me, {
      input: { userId: request.user!.sub },
      context: context(request),
    });
  }
}
