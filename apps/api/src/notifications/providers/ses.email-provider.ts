import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { log } from '../../common/logger';
import type { EmailMessage, EmailProvider } from './email-provider';

/**
 * Amazon SES adapter. Uses AWS SDK only when EMAIL_PROVIDER=ses.
 * Lazy-loads client so local installs don't require @aws-sdk/client-ses until used.
 */
@Injectable()
export class SesEmailProvider implements EmailProvider {
  readonly name = 'ses';

  async send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    const from = process.env.EMAIL_FROM;
    if (!from) {
      throw new ServiceUnavailableException({
        error: { code: 'EMAIL_NOT_CONFIGURED', message: 'EMAIL_FROM required for SES' },
      });
    }

    try {
      // Optional peer dependency — install @aws-sdk/client-ses for production SES.
      const sesMod = (await import(
        /* webpackIgnore: true */ '@aws-sdk/client-ses' as string
      ).catch(() => null)) as {
        SESClient: new (cfg: { region: string }) => {
          send: (cmd: unknown) => Promise<{ MessageId?: string }>;
        };
        SendEmailCommand: new (input: unknown) => unknown;
      } | null;

      if (!sesMod?.SESClient || !sesMod?.SendEmailCommand) {
        throw new Error(
          '@aws-sdk/client-ses not installed — add dependency or use EMAIL_PROVIDER=console',
        );
      }
      const region = process.env.AWS_REGION ?? process.env.SES_REGION ?? 'us-east-1';
      const client = new sesMod.SESClient({ region });
      const result = await client.send(
        new sesMod.SendEmailCommand({
          Source: from,
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: message.textBody, Charset: 'UTF-8' },
              ...(message.htmlBody
                ? { Html: { Data: message.htmlBody, Charset: 'UTF-8' } }
                : {}),
            },
          },
          ReplyToAddresses: process.env.EMAIL_REPLY_TO
            ? [process.env.EMAIL_REPLY_TO]
            : undefined,
          ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
        }),
      );
      const providerMessageId = result.MessageId ?? `ses-${Date.now()}`;
      log.info('email_ses_sent', {
        providerMessageId,
        tags: message.tags,
      });
      return { providerMessageId };
    } catch (e) {
      log.error('email_ses_failed', {
        code: e instanceof Error ? e.name : 'SES_ERROR',
        message: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
        tags: message.tags,
      });
      throw e;
    }
  }
}
