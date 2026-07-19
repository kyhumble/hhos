import { Injectable } from '@nestjs/common';
import { log } from '../../common/logger';
import type { EmailMessage, EmailProvider } from './email-provider';

/**
 * Local/dev sink — logs subject + to (no body) so tokens aren't dumped to console by default.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    const id = `console-${Date.now()}`;
    log.info('email_console_send', {
      providerMessageId: id,
      to: message.to,
      subject: message.subject,
      tags: message.tags,
      bodyChars: message.textBody.length,
    });
    // Dev dogfood: print link-looking lines only (paths, not full secrets if avoidable)
    if (process.env.EMAIL_CONSOLE_PRINT_BODY === 'true') {
      log.debug('email_console_body', { subject: message.subject, bodyPreview: message.textBody.slice(0, 200) });
    }
    return { providerMessageId: id };
  }
}
