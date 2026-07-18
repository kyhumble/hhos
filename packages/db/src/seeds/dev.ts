/**
 * SYNTHETIC demo data only — never seed real patient information.
 */
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, type RoleCode } from '@hhos/shared';
import { createDb } from '../client';
import {
  careTeamMembers,
  clinicalHistoryItems,
  consentRecords,
  consentSignatures,
  consentTemplatePurposes,
  consentTemplates,
  coverages,
  devices,
  episodes,
  intakeChecklistItems,
  organizations,
  patientAddresses,
  patientContacts,
  patientFlags,
  patients,
  permissions,
  referrals,
  rolePermissions,
  roles,
  userRoles,
  users,
  visits,
  wounds,
} from '../schema/index';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const COORD_ID = '00000000-0000-4000-8000-000000000011';
const RN_ID = '00000000-0000-4000-8000-000000000012';
const LEAD_ID = '00000000-0000-4000-8000-000000000013';
const COMPLIANCE_ID = '00000000-0000-4000-8000-000000000014';

const PATIENT_ALICE = '00000000-0000-4000-8000-000000000021';
const PATIENT_BRUNO = '00000000-0000-4000-8000-000000000022';
const PATIENT_CARA = '00000000-0000-4000-8000-000000000023';

const REFERRAL_A = '00000000-0000-4000-8000-000000000031';
const EPISODE_A = '00000000-0000-4000-8000-000000000041';

const WOUND_A = '00000000-0000-4000-8000-000000000081';
const VISIT_A = '00000000-0000-4000-8000-000000000082';
const DEVICE_ROW_A = '00000000-0000-4000-8000-000000000091';
/** Synthetic app-generated device id (not a real install). */
const DEVICE_ID_A = 'demo-device-00000000-0000-4000-8000-000000000092';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const PLACEHOLDER_LEGAL =
  '> **NOT LEGAL FINAL** — Placeholder for Compliance Officer / counsel review.\n\n';

function templateBody(title: string, extra: string): string {
  return `${PLACEHOLDER_LEGAL}# ${title}\n\n${extra}\n\nBy signing, the signer acknowledges they have read and understand this notice.`;
}

async function main() {
  const db = createDb();

  console.log('[hhos/db] Seeding synthetic demo data...');

  // Org — merge Phase 2 settings on re-seed so PR1-era rows pick up photo/large-wound keys
  const phase2OrgSettingsPatch = {
    largeWoundLengthCm: 10,
    largeWoundWidthCm: 10,
    largeWoundAreaCm2: 50,
    photoMaxBytes: 12_000_000,
    photoPendingTtlHours: 24,
  } as const;

  await db
    .insert(organizations)
    .values({
      id: ORG_ID,
      name: 'Total Wound Care Demo LLC',
      npi: '1999999999',
      timezone: 'America/Chicago',
      settings: {
        socDueHours: 48,
        photoGeotagEnabled: false,
        coverageVerifiedRequired: false,
        woundPathwayDefault: true,
        ...phase2OrgSettingsPatch,
      },
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        settings: sql`${organizations.settings} || ${JSON.stringify(phase2OrgSettingsPatch)}::jsonb`,
      },
    });

  // Permissions — re-run this seed after pulling Phase 2+ permission codes so
  // `permissions` / `role_permissions` pick up wound_photo:*, clinical_task:*, device:*.
  for (const code of ALL_PERMISSIONS) {
    await db.insert(permissions).values({ code, description: code }).onConflictDoNothing();
  }

  const allPerms = await db.select().from(permissions);
  const permByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  const roleDefs: { code: RoleCode; name: string; id: string }[] = [
    { code: 'intake_coordinator', name: 'Intake Coordinator', id: '00000000-0000-4000-8000-000000000051' },
    { code: 'field_rn', name: 'Field RN', id: '00000000-0000-4000-8000-000000000052' },
    { code: 'clinical_lead', name: 'Clinical Lead', id: '00000000-0000-4000-8000-000000000053' },
    { code: 'compliance', name: 'Compliance', id: '00000000-0000-4000-8000-000000000054' },
    { code: 'billing', name: 'Billing', id: '00000000-0000-4000-8000-000000000055' },
    { code: 'admin', name: 'Admin', id: '00000000-0000-4000-8000-000000000056' },
  ];

  for (const r of roleDefs) {
    await db
      .insert(roles)
      .values({ id: r.id, orgId: ORG_ID, code: r.code, name: r.name })
      .onConflictDoNothing();

    for (const p of ROLE_PERMISSIONS[r.code]) {
      const permissionId = permByCode.get(p);
      if (!permissionId) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: r.id, permissionId })
        .onConflictDoNothing();
    }
  }

  const userDefs = [
    { id: COORD_ID, email: 'coord@demo.local', fullName: 'Casey Coordinator', roleId: roleDefs[0]!.id },
    { id: RN_ID, email: 'rn@demo.local', fullName: 'Riley Nurse', roleId: roleDefs[1]!.id },
    { id: LEAD_ID, email: 'lead@demo.local', fullName: 'Logan Lead', roleId: roleDefs[2]!.id },
    {
      id: COMPLIANCE_ID,
      email: 'compliance@demo.local',
      fullName: 'Cameron Compliance',
      roleId: roleDefs[3]!.id,
      mfaRequired: true,
    },
  ] as const;

  for (const u of userDefs) {
    await db
      .insert(users)
      .values({
        id: u.id,
        orgId: ORG_ID,
        email: u.email,
        fullName: u.fullName,
        status: 'active',
        mfaRequired: 'mfaRequired' in u ? u.mfaRequired : false,
        cognitoSub: `local-${u.id}`,
      })
      .onConflictDoNothing();

    await db
      .insert(userRoles)
      .values({ userId: u.id, roleId: u.roleId })
      .onConflictDoNothing();
  }

  // Patients
  await db
    .insert(patients)
    .values([
      {
        id: PATIENT_ALICE,
        orgId: ORG_ID,
        mrn: 'DEMO-0001',
        firstName: 'Alice',
        lastName: 'Adams',
        dob: '1950-01-15',
        sexAtBirth: 'female',
        preferredLanguage: 'en',
        capacityStatus: 'assumed_capacity',
        status: 'prospect',
        createdBy: COORD_ID,
        updatedBy: COORD_ID,
      },
      {
        id: PATIENT_BRUNO,
        orgId: ORG_ID,
        mrn: 'DEMO-0002',
        firstName: 'Bruno',
        lastName: 'Diaz',
        dob: '1942-07-04',
        sexAtBirth: 'male',
        preferredLanguage: 'es',
        interpreterNeeded: true,
        capacityStatus: 'impaired',
        status: 'prospect',
        createdBy: COORD_ID,
        updatedBy: COORD_ID,
      },
      {
        id: PATIENT_CARA,
        orgId: ORG_ID,
        mrn: 'DEMO-0003',
        firstName: 'Cara',
        lastName: 'Chen',
        dob: '1938-11-20',
        sexAtBirth: 'female',
        preferredLanguage: 'en',
        capacityStatus: 'assumed_capacity',
        status: 'prospect',
        createdBy: COORD_ID,
        updatedBy: COORD_ID,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(patientAddresses)
    .values([
      {
        orgId: ORG_ID,
        patientId: PATIENT_ALICE,
        type: 'service',
        line1: '123 Oak St',
        city: 'Tulsa',
        state: 'OK',
        postalCode: '74103',
        county: 'Tulsa',
      },
      {
        orgId: ORG_ID,
        patientId: PATIENT_BRUNO,
        type: 'service',
        line1: '456 Maple Ave',
        city: 'Oklahoma City',
        state: 'OK',
        postalCode: '73102',
        ruralFlag: false,
      },
      {
        orgId: ORG_ID,
        patientId: PATIENT_CARA,
        type: 'service',
        line1: '789 Rural Rd',
        city: 'Enid',
        state: 'OK',
        postalCode: '73701',
        ruralFlag: true,
      },
    ])
    .onConflictDoNothing();

  await db.insert(patientContacts).values({
    orgId: ORG_ID,
    patientId: PATIENT_BRUNO,
    type: 'surrogate',
    fullName: 'Maria Diaz',
    relationship: 'daughter',
    phone: '555-0102',
    legalAuthority: 'poa_healthcare',
  });

  await db.insert(coverages).values([
    {
      orgId: ORG_ID,
      patientId: PATIENT_ALICE,
      rank: 1,
      payerType: 'medicare_ff',
      payerName: 'Medicare Part A/B (Demo)',
      memberIdLast4: '1234',
      verificationStatus: 'active',
      verifiedAt: new Date(),
      verifiedBy: COORD_ID,
    },
    {
      orgId: ORG_ID,
      patientId: PATIENT_CARA,
      rank: 1,
      payerType: 'medicare_advantage',
      payerName: 'Demo MA Plan',
      memberIdLast4: '9999',
      dualEligible: true,
      verificationStatus: 'pending',
    },
  ]);

  await db.insert(clinicalHistoryItems).values({
    orgId: ORG_ID,
    patientId: PATIENT_ALICE,
    category: 'condition',
    codeSystem: 'ICD-10',
    code: 'L97.909',
    displayText: 'Non-pressure chronic ulcer of unspecified part of unspecified lower leg',
    active: true,
    createdBy: COORD_ID,
  });

  await db.insert(patientFlags).values([
    {
      orgId: ORG_ID,
      patientId: PATIENT_BRUNO,
      code: 'language_barrier',
      createdBy: COORD_ID,
    },
    {
      orgId: ORG_ID,
      patientId: PATIENT_BRUNO,
      code: 'capacity_concern',
      createdBy: COORD_ID,
    },
    {
      orgId: ORG_ID,
      patientId: PATIENT_CARA,
      code: 'expedited_admit',
      createdBy: COORD_ID,
    },
    {
      orgId: ORG_ID,
      patientId: PATIENT_CARA,
      code: 'dual_eligible',
      createdBy: COORD_ID,
    },
    {
      orgId: ORG_ID,
      patientId: PATIENT_CARA,
      code: 'high_travel',
      createdBy: COORD_ID,
    },
  ]);

  // Consent templates
  const templates: {
    id: string;
    consentType:
      | 'HIPAA_NPP'
      | 'ADMISSION'
      | 'WOUND_PHOTO'
      | 'ROI'
      | 'FINANCIAL';
    locale: string;
    title: string;
    body: string;
    admission: boolean;
    photo: boolean;
    purposes: (
      | 'TREATMENT'
      | 'PAYMENT'
      | 'HOPS'
      | 'WOUND_PHOTO_CLINICAL'
      | 'WOUND_PHOTO_QA'
      | 'SHARE_PHYSICIAN'
      | 'SHARE_PAYER'
    )[];
  }[] = [
    {
      id: '00000000-0000-4000-8000-000000000061',
      consentType: 'HIPAA_NPP',
      locale: 'en',
      title: 'Notice of Privacy Practices Acknowledgment',
      body: templateBody(
        'Notice of Privacy Practices',
        'This acknowledgment confirms you received our Notice of Privacy Practices describing how protected health information may be used and disclosed.',
      ),
      admission: true,
      photo: false,
      purposes: ['TREATMENT', 'PAYMENT', 'HOPS'],
    },
    {
      id: '00000000-0000-4000-8000-000000000062',
      consentType: 'ADMISSION',
      locale: 'en',
      title: 'Admission / Treatment Consent',
      body: templateBody(
        'Admission Consent',
        'You consent to evaluation and skilled services as ordered by your physician, including home visits for wound care as clinically appropriate.',
      ),
      admission: true,
      photo: false,
      purposes: ['TREATMENT', 'PAYMENT', 'HOPS', 'SHARE_PHYSICIAN'],
    },
    {
      id: '00000000-0000-4000-8000-000000000063',
      consentType: 'WOUND_PHOTO',
      locale: 'en',
      title: 'Clinical Wound Photography Consent',
      body: templateBody(
        'Wound Photography Consent',
        'You authorize clinical photographs of wounds for treatment documentation and quality review. Photos are stored encrypted, linked to this consent, and accessible only to authorized workforce. Gallery imports are not used as clinical source of truth. Purpose limitation: clinical care and QA only unless you authorize additional purposes.',
      ),
      admission: false,
      photo: true,
      purposes: ['WOUND_PHOTO_CLINICAL', 'WOUND_PHOTO_QA', 'TREATMENT'],
    },
    {
      id: '00000000-0000-4000-8000-000000000064',
      consentType: 'FINANCIAL',
      locale: 'en',
      title: 'Financial Responsibility / Assignment of Benefits',
      body: templateBody(
        'Financial Consent',
        'You assign benefits to the agency and acknowledge financial responsibility for non-covered services as explained by staff.',
      ),
      admission: true,
      photo: false,
      purposes: ['PAYMENT', 'SHARE_PAYER'],
    },
    {
      id: '00000000-0000-4000-8000-000000000065',
      consentType: 'ROI',
      locale: 'en',
      title: 'Release of Information',
      body: templateBody(
        'Release of Information',
        'You authorize release of relevant clinical information to designated recipients for continuity of care or payment as specified at the time of request.',
      ),
      admission: false,
      photo: false,
      purposes: ['SHARE_PHYSICIAN', 'SHARE_PAYER', 'TREATMENT'],
    },
    {
      id: '00000000-0000-4000-8000-000000000066',
      consentType: 'ADMISSION',
      locale: 'es',
      title: 'Consentimiento de Admisión / Tratamiento (ES)',
      body: templateBody(
        'Consentimiento de Admisión',
        '[ES PLACEHOLDER] Usted consiente a la evaluación y servicios calificados según lo ordenado por su médico.',
      ),
      admission: true,
      photo: false,
      purposes: ['TREATMENT', 'PAYMENT', 'HOPS'],
    },
    {
      id: '00000000-0000-4000-8000-000000000067',
      consentType: 'WOUND_PHOTO',
      locale: 'es',
      title: 'Consentimiento de Fotografía de Heridas (ES)',
      body: templateBody(
        'Fotografía Clínica de Heridas',
        '[ES PLACEHOLDER] Autoriza fotografías clínicas de heridas para documentación y control de calidad.',
      ),
      admission: false,
      photo: true,
      purposes: ['WOUND_PHOTO_CLINICAL', 'WOUND_PHOTO_QA'],
    },
  ];

  for (const t of templates) {
    const bodySha = sha256(t.body);
    await db
      .insert(consentTemplates)
      .values({
        id: t.id,
        orgId: ORG_ID,
        consentType: t.consentType,
        version: 1,
        title: t.title,
        bodyMarkdown: t.body,
        bodySha256: bodySha,
        locale: t.locale,
        status: 'active',
        isRequiredForAdmission: t.admission,
        isRequiredForWoundPhoto: t.photo,
        allowsSurrogate: true,
        createdBy: COMPLIANCE_ID,
      })
      .onConflictDoNothing();

    for (const purpose of t.purposes) {
      await db
        .insert(consentTemplatePurposes)
        .values({ templateId: t.id, purposeCode: purpose })
        .onConflictDoNothing();
    }
  }

  // Referral + episode for Alice
  const receivedAt = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const socDueAt = new Date(receivedAt.getTime() + 48 * 60 * 60 * 1000);

  await db
    .insert(referrals)
    .values({
      id: REFERRAL_A,
      orgId: ORG_ID,
      patientId: PATIENT_ALICE,
      sourceType: 'hospital',
      sourceName: 'Demo Memorial Hospital',
      sourceContact: 'Case Mgmt 555-0199',
      receivedAt,
      acuity: 'routine',
      reasonForReferral: 'Home wound care evaluation after discharge — synthetic demo',
      primaryDiagnosisText: 'Lower extremity chronic ulcer',
      primaryDiagnosisIcd10: 'L97.909',
      requestedServices: JSON.stringify(['sn', 'wound']),
      status: 'accepted',
      intakeOwnerId: COORD_ID,
      completenessScore: 55,
      createdBy: COORD_ID,
      updatedBy: COORD_ID,
    })
    .onConflictDoNothing();

  await db
    .insert(episodes)
    .values({
      id: EPISODE_A,
      orgId: ORG_ID,
      patientId: PATIENT_ALICE,
      referralId: REFERRAL_A,
      episodeNumber: 1,
      careType: 'wound_only',
      status: 'pre_admit',
      referralReceivedAt: receivedAt,
      socDueAt,
      primaryDxIcd10: 'L97.909',
      f2fStatus: 'unknown',
      ordersStatus: 'missing',
      intakeStatus: 'incomplete',
      createdBy: COORD_ID,
      updatedBy: COORD_ID,
    })
    .onConflictDoNothing();

  await db.insert(careTeamMembers).values({
    orgId: ORG_ID,
    episodeId: EPISODE_A,
    userId: RN_ID,
    teamRole: 'primary_rn',
    active: true,
    assignedBy: COORD_ID,
  });

  const checklistDefaults: {
    code:
      | 'DEMOGRAPHICS_COMPLETE'
      | 'SERVICE_ADDRESS'
      | 'PRIMARY_COVERAGE'
      | 'COVERAGE_VERIFIED'
      | 'NPP_ACK'
      | 'ADMISSION_CONSENT'
      | 'PHOTO_CONSENT'
      | 'ROI'
      | 'FINANCIAL'
      | 'F2F_STATUS_KNOWN'
      | 'ORDERS_STATUS_KNOWN'
      | 'PRIMARY_DX_PRESENT'
      | 'HISTORY_STARTED'
      | 'SURROGATE_DOCUMENTED';
    required: boolean;
    status: 'pending' | 'complete';
  }[] = [
    { code: 'DEMOGRAPHICS_COMPLETE', required: true, status: 'complete' },
    { code: 'SERVICE_ADDRESS', required: true, status: 'complete' },
    { code: 'PRIMARY_COVERAGE', required: true, status: 'complete' },
    { code: 'COVERAGE_VERIFIED', required: false, status: 'complete' },
    { code: 'NPP_ACK', required: true, status: 'complete' },
    { code: 'ADMISSION_CONSENT', required: true, status: 'complete' },
    { code: 'PHOTO_CONSENT', required: true, status: 'pending' },
    { code: 'ROI', required: false, status: 'pending' },
    { code: 'FINANCIAL', required: true, status: 'pending' },
    { code: 'F2F_STATUS_KNOWN', required: true, status: 'pending' },
    { code: 'ORDERS_STATUS_KNOWN', required: true, status: 'pending' },
    { code: 'PRIMARY_DX_PRESENT', required: false, status: 'complete' },
    { code: 'HISTORY_STARTED', required: false, status: 'complete' },
    { code: 'SURROGATE_DOCUMENTED', required: false, status: 'pending' },
  ];

  for (const item of checklistDefaults) {
    await db
      .insert(intakeChecklistItems)
      .values({
        orgId: ORG_ID,
        episodeId: EPISODE_A,
        code: item.code,
        required: item.required,
        status: item.status,
        completedAt: item.status === 'complete' ? new Date() : null,
        completedBy: item.status === 'complete' ? COORD_ID : null,
      })
      .onConflictDoNothing();
  }

  // Alice signed NPP + Admission
  const nppTemplate = await db
    .select()
    .from(consentTemplates)
    .where(eq(consentTemplates.id, '00000000-0000-4000-8000-000000000061'))
    .limit(1);

  const admTemplate = await db
    .select()
    .from(consentTemplates)
    .where(eq(consentTemplates.id, '00000000-0000-4000-8000-000000000062'))
    .limit(1);

  if (nppTemplate[0]) {
    const recId = '00000000-0000-4000-8000-000000000071';
    await db
      .insert(consentRecords)
      .values({
        id: recId,
        orgId: ORG_ID,
        patientId: PATIENT_ALICE,
        episodeId: EPISODE_A,
        templateId: nppTemplate[0].id,
        templateVersion: nppTemplate[0].version,
        templateBodySha256: nppTemplate[0].bodySha256,
        status: 'signed',
        capturedAt: new Date(),
        capturedByUserId: COORD_ID,
        captureMethod: 'onscreen',
        signerType: 'patient',
        signerName: 'Alice Adams',
        patientPresent: true,
        localeUsed: 'en',
      })
      .onConflictDoNothing();

    await db.insert(consentSignatures).values({
      consentRecordId: recId,
      signatureType: 'typed',
      typedName: 'Alice Adams',
      attestedStatement: 'I have read and understand this notice.',
    });
  }

  if (admTemplate[0]) {
    const recId = '00000000-0000-4000-8000-000000000072';
    await db
      .insert(consentRecords)
      .values({
        id: recId,
        orgId: ORG_ID,
        patientId: PATIENT_ALICE,
        episodeId: EPISODE_A,
        templateId: admTemplate[0].id,
        templateVersion: admTemplate[0].version,
        templateBodySha256: admTemplate[0].bodySha256,
        status: 'signed',
        capturedAt: new Date(),
        capturedByUserId: COORD_ID,
        captureMethod: 'onscreen',
        signerType: 'patient',
        signerName: 'Alice Adams',
        patientPresent: true,
        localeUsed: 'en',
      })
      .onConflictDoNothing();

    await db.insert(consentSignatures).values({
      consentRecordId: recId,
      signatureType: 'typed',
      typedName: 'Alice Adams',
      attestedStatement: 'I consent to admission and treatment as described.',
    });
  }

  // Phase 2: synthetic device + wound (no photo imagery / ciphertext)
  await db
    .insert(devices)
    .values({
      id: DEVICE_ROW_A,
      orgId: ORG_ID,
      userId: RN_ID,
      deviceId: DEVICE_ID_A,
      platform: 'ios',
      model: 'Demo iPhone',
      osVersion: 'iOS 18.0',
      appVersion: '0.1.0-demo',
      status: 'active',
      lastSeenAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(wounds)
    .values({
      id: WOUND_A,
      orgId: ORG_ID,
      patientId: PATIENT_ALICE,
      episodeId: EPISODE_A,
      label: 'Left lower leg — synthetic demo wound',
      bodySiteCode: 'LLL',
      laterality: 'left',
      woundType: 'venous_ulcer',
      openedAt: receivedAt,
      status: 'active',
      createdBy: RN_ID,
    })
    .onConflictDoNothing();

  await db
    .insert(visits)
    .values({
      id: VISIT_A,
      orgId: ORG_ID,
      patientId: PATIENT_ALICE,
      episodeId: EPISODE_A,
      clinicianUserId: RN_ID,
      startedAt: receivedAt,
      visitType: 'soc',
      status: 'in_progress',
      clientVisitId: 'demo-visit-alice-soc-001',
    })
    .onConflictDoNothing();

  console.log('[hhos/db] Seed complete (synthetic only; no wound photo imagery).');
  console.log('[hhos/db] Demo users: coord@demo.local, rn@demo.local, lead@demo.local, compliance@demo.local');
  process.exit(0);
}

main().catch((err) => {
  console.error('[hhos/db] Seed failed', err instanceof Error ? err.message : err);
  process.exit(1);
});
