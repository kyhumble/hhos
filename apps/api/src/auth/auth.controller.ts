import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DevLoginSchema } from '@hhos/shared';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('auth')
@Controller('v1')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/dev-login')
  async devLogin(@Body(new ZodValidationPipe(DevLoginSchema)) body: unknown) {
    return this.auth.devLogin(body as never);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
