import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConsoleEmailProvider } from './providers/console.email-provider';
import { EMAIL_PROVIDER } from './providers/email-provider';
import { SesEmailProvider } from './providers/ses.email-provider';
import { NotificationsService } from './notifications.service';

function emailProviderFactory() {
  const kind = (process.env.EMAIL_PROVIDER ?? 'console').toLowerCase();
  if (kind === 'ses') return new SesEmailProvider();
  return new ConsoleEmailProvider();
}

@Module({
  imports: [AuditModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: emailProviderFactory,
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
