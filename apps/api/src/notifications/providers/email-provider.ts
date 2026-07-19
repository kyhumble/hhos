export type EmailMessage = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  /** Non-PHI tags only (orgId, template, deliveryId). */
  tags?: Record<string, string>;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
