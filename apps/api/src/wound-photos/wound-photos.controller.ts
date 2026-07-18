import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  CompleteWoundPhotoUploadSchema,
  InitiateWoundPhotoUploadSchema,
  Permission,
  WrapDekSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { WoundPhotosService } from './wound-photos.service';

@ApiTags('wound-photos')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class WoundPhotosController {
  constructor(private readonly photos: WoundPhotosService) {}

  /**
   * Initiate encrypted photo upload — returns device-facing presigned PUT.
   * Idempotency-Key must equal body.clientPhotoId when provided.
   */
  @Post('wound-photos/uploads')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  initiate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(InitiateWoundPhotoUploadSchema)) body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.photos.initiate(user, body as never, {
      idempotencyKey,
      ...requestMeta(req),
    });
  }

  /**
   * Single-use DEK wrap. Body must never be logged.
   */
  @Post('wound-photos/:id/wrap-dek')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  wrapDek(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(WrapDekSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.photos.wrapDek(user, id, body as never, requestMeta(req));
  }

  /**
   * Finalize after PUT: full ciphertext SHA-256 via internal S3 client.
   * Sets measurements + is_large_wound only (no clinical_tasks).
   */
  @Post('wound-photos/:id/complete')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteWoundPhotoUploadSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.photos.complete(user, id, body as never, requestMeta(req));
  }

  /**
   * Capturer abandons a pending_* photo (not soft-delete of available).
   */
  @Post('wound-photos/:id/abandon')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  abandon(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.photos.abandon(user, id, requestMeta(req));
  }
}
