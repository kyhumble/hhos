export function buildPhysicianSignEmail(input: {
  orgName: string;
  docTypeLabel: string;
  signUrl: string;
  expiresAt: Date;
  physicianName: string;
  patientInitials?: string;
  dobYear?: string | number | null;
}): { subject: string; textBody: string } {
  const expires = input.expiresAt.toISOString();
  const patientRef =
    input.patientInitials && input.dobYear
      ? `Patient reference: ${input.patientInitials}, DOB year ${input.dobYear}`
      : input.patientInitials
        ? `Patient reference: ${input.patientInitials}`
        : null;

  return {
    subject: `Signature requested — ${input.orgName}`,
    textBody: [
      `${input.orgName} requests your signature on a ${input.docTypeLabel}.`,
      '',
      `Open secure link (expires ${expires} UTC):`,
      input.signUrl,
      '',
      ...(patientRef ? [patientRef] : []),
      `Physician: ${input.physicianName}`,
      '',
      'Do not forward this link. Questions: contact the agency (not this mailbox).',
    ].join('\n'),
  };
}

export function docTypeLabel(docType: string): string {
  const map: Record<string, string> = {
    plan_of_care_485: 'Plan of Care / CMS-485',
    physician_order: 'physician order',
    verbal_order: 'verbal order',
    f2f_encounter: 'face-to-face encounter',
    hospice_cert: 'hospice certification',
    hospice_recert: 'hospice recertification',
  };
  return map[docType] ?? docType.replace(/_/g, ' ');
}
