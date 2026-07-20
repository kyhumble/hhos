import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DevLoginSchema, SessionExchangeSchema } from '@hhos/shared';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('auth')
@Controller('v1')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Local/dev only — disabled when AUTH_PROVIDER=cognito. */
  @Post('auth/dev-login')
  async devLogin(@Body(new ZodValidationPipe(DevLoginSchema)) body: unknown) {
    return this.auth.devLogin(body as never);
  }

  /**
   * Production session: Cognito ID token → HHOS app JWT.
   * RLS bypass (unauthenticated). Multi-org → 409 ORG_SELECTION_REQUIRED.
   */
  @Post('auth/session')
  async session(@Body(new ZodValidationPipe(SessionExchangeSchema)) body: unknown) {
    return this.auth.exchangeSession(body as never);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
