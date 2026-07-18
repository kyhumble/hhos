import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';

@ApiTags('auth')
@Controller('v1')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/dev-login')
  async devLogin(@Body() body: { email?: string }) {
    if (!body.email) {
      return {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'email is required',
        },
      };
    }
    return this.auth.devLogin(body.email);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
