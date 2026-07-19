import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CompleteOrderUploadSchema,
  CreateOrderPackageSchema,
  Permission,
  ProviderSignSchema,
  RecordExternalSignSchema,
  SendOrderPackageSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('v1')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('order-packages')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_WRITE)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateOrderPackageSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orders.create(user, body as never, requestMeta(req));
  }

  @Get('order-packages')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('episodeId') episodeId?: string,
  ) {
    return this.orders.list(user, { status, episodeId });
  }

  @Get('order-packages/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getById(user, id);
  }

  @Post('order-packages/:id/upload')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_WRITE)
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orders.initiateUpload(user, id, requestMeta(req));
  }

  @Post('order-packages/:id/complete-upload')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_WRITE)
  completeUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteOrderUploadSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orders.completeUpload(user, id, body as never, requestMeta(req));
  }

  @Post('order-packages/:id/mark-ready')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_WRITE)
  markReady(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orders.markReadyWithoutFile(user, id, requestMeta(req));
  }

  @Post('order-packages/:id/send')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_SEND)
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendOrderPackageSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orders.send(user, id, body as never, requestMeta(req));
  }

  @Post('order-packages/:id/void')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_SEND)
  voidPkg(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orders.voidPackage(user, id, requestMeta(req));
  }

  @Post('order-packages/:id/record-external-sign')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_SEND)
  external(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RecordExternalSignSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orders.recordExternalSign(user, id, body as never, requestMeta(req));
  }

  @Get('worklists/orders-signatures')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORDER_READ)
  worklist(@CurrentUser() user: AuthUser) {
    return this.orders.worklist(user);
  }

  /** Public provider preview (limited PHI). */
  @Get('sign/:token')
  peek(@Param('token') token: string) {
    return this.orders.peekSign(token);
  }

  /** Public provider e-sign / reject. */
  @Post('sign/:token')
  sign(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(ProviderSignSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    const meta = requestMeta(req);
    return this.orders.providerSign(token, body as never, {
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
