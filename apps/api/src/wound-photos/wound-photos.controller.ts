import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Req,
  StreamableFile,
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

  // ─── PR 6: list / detail / content / soft-delete ──────────────────────────

  /**
   * Metadata list for episode photos (caseload scoped). No image bytes (K22).
   */
  @Get('episodes/:episodeId/wound-photos')
  @RequirePermissions(Permission.WOUND_PHOTO_READ)
  listForEpisode(
    @CurrentUser() user: AuthUser,
    @Param('episodeId') episodeId: string,
  ) {
    return this.photos.listForEpisode(user, episodeId);
  }

  /**
   * Metadata list for wound photos (caseload scoped). No image bytes (K22).
   */
  @Get('wounds/:woundId/photos')
  @RequirePermissions(Permission.WOUND_PHOTO_READ)
  listForWound(
    @CurrentUser() user: AuthUser,
    @Param('woundId') woundId: string,
  ) {
    return this.photos.listForWound(user, woundId);
  }

  /**
   * Metadata detail (geo role-filtered). Requires wound_photo:read (not document:read).
   */
  @Get('wound-photos/:id')
  @RequirePermissions(Permission.WOUND_PHOTO_READ)
  getDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.photos.getDetail(user, id);
  }

  /**
   * Canonical decrypt-proxy stream only — no view-url endpoint (K22).
   * Clinical path re-asserts WOUND_PHOTO_CLINICAL (K28).
   * Compliance break-glass: X-Break-Glass-Reason + break_glass:phi (K16).
   */
  @Get('wound-photos/:id/content')
  @RequirePermissions(Permission.WOUND_PHOTO_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({
    name: 'X-Break-Glass-Reason',
    required: false,
    description: 'Required for compliance break-glass view (skip purpose assert)',
  })
  async getContent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Headers('x-break-glass-reason') breakGlassReason: string | undefined,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ): Promise<StreamableFile> {
    const { stream, contentType } = await this.photos.getContent(user, id, {
      ...requestMeta(req),
      breakGlassReason,
    });
    return new StreamableFile(stream, {
      type: contentType,
      disposition: 'inline',
    });
  }

  /**
   * Soft-delete available photo. field_rn lacks wound_photo:delete.
   */
  @Delete('wound-photos/:id')
  @RequirePermissions(Permission.WOUND_PHOTO_DELETE)
  softDelete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.photos.softDelete(user, id, requestMeta(req));
  }
}
