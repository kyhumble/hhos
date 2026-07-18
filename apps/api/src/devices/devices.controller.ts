import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Permission,
  RegisterDeviceSchema,
  RevokeDeviceSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @RequirePermissions(Permission.DEVICE_REGISTER)
  listMine(@CurrentUser() user: AuthUser) {
    return this.devices.listMine(user);
  }

  @Post('register')
  @RequirePermissions(Permission.DEVICE_REGISTER)
  register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.devices.register(user, body as never, requestMeta(req));
  }

  @Post(':deviceId/revoke')
  @RequirePermissions(Permission.DEVICE_REVOKE)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('deviceId') deviceId: string,
    @Body(new ZodValidationPipe(RevokeDeviceSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.devices.revoke(user, deviceId, body as never, requestMeta(req));
  }
}
