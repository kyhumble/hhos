import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateClinicalHistorySchema,
  CreateCoverageSchema,
  CreatePatientSchema,
  Permission,
  PutPatientAddressesSchema,
  PutPatientContactsSchema,
  UpdatePatientSchema,
  VerifyCoverageSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1/patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @RequirePermissions(Permission.PATIENT_READ)
  list(@CurrentUser() user: AuthUser) {
    return this.patients.list(user);
  }

  @Post()
  @RequirePermissions(Permission.PATIENT_WRITE)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreatePatientSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    const meta = requestMeta(req);
    return this.patients.create(user, body as never, meta);
  }

  @Get(':id')
  @RequirePermissions(Permission.PATIENT_READ)
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.patients.getById(user, id);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }
    return row;
  }

  @Patch(':id')
  @RequirePermissions(Permission.PATIENT_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePatientSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.patients.update(user, id, body as never, requestMeta(req));
  }

  @Put(':id/addresses')
  @RequirePermissions(Permission.PATIENT_WRITE)
  putAddresses(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PutPatientAddressesSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.patients.putAddresses(user, id, body as never, requestMeta(req));
  }

  @Put(':id/contacts')
  @RequirePermissions(Permission.PATIENT_WRITE)
  putContacts(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PutPatientContactsSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.patients.putContacts(user, id, body as never, requestMeta(req));
  }

  @Get(':id/clinical-history')
  @RequirePermissions(Permission.PATIENT_READ)
  listHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patients.listHistory(user, id);
  }

  @Post(':id/clinical-history')
  @RequirePermissions(Permission.PATIENT_WRITE)
  addHistory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateClinicalHistorySchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.patients.addHistory(user, id, body as never, requestMeta(req));
  }

  @Get(':id/coverages')
  @RequirePermissions(Permission.PATIENT_READ)
  listCoverages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patients.listCoverages(user, id);
  }

  @Post(':id/coverages')
  @RequirePermissions(Permission.COVERAGE_WRITE, Permission.PATIENT_WRITE)
  addCoverage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateCoverageSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.patients.addCoverage(user, id, body as never, requestMeta(req));
  }

  @Patch(':id/coverages/:coverageId')
  @RequirePermissions(Permission.COVERAGE_WRITE, Permission.PATIENT_WRITE)
  verifyCoverage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('coverageId') coverageId: string,
    @Body(new ZodValidationPipe(VerifyCoverageSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.patients.verifyCoverage(
      user,
      id,
      coverageId,
      body as never,
      requestMeta(req),
    );
  }
}
