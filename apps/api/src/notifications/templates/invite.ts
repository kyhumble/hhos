export function buildOrgInviteEmail(input: {
  orgName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresAt: Date;
}): { subject: string; textBody: string } {
  const expires = input.expiresAt.toISOString();
  return {
    subject: `You're invited to ${input.orgName} on HHOS`,
    textBody: [
      `You have been invited to join ${input.orgName} as ${input.roleLabel}.`,
      '',
      `Accept your invite (expires ${expires} UTC):`,
      input.acceptUrl,
      '',
      'If you did not expect this message, ignore it.',
    ].join('\n'),
  };
}

/** Role codes → human labels for invite email only (no PHI). */
export function roleLabel(roleCode: string): string {
  const map: Record<string, string> = {
    field_rn: 'Field RN',
    intake_coordinator: 'Intake coordinator',
    clinical_lead: 'Clinical lead',
    billing: 'Billing',
    compliance: 'Compliance',
    admin: 'Administrator',
  };
  return map[roleCode] ?? roleCode;
}
