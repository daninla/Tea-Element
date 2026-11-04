import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { emailToken } from '../domain/email-token';
@Injectable()
export class ChallengeMailWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private readonly transport = createTransport(readEnvironment().SMTP_URL, {
    connectionTimeout: 3000,
    socketTimeout: 5000,
  });
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  onModuleInit() {
    if (readEnvironment().NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.send()
          .catch(() => {})
          .finally(() => {
            this.active = undefined;
          });
    }, 1000);
    this.timer.unref();
  }
  async send() {
    await this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM email_challenges WHERE mailed_at IS NULL AND used_at IS NULL AND expires_at>NOW() AND next_attempt_at<=NOW() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!rows[0]) return;
        const row = await tx.emailChallenge.findUniqueOrThrow({
          where: { id: rows[0].id },
          include: { user: true },
        });
        if (!row.user.isActive) {
          await tx.emailChallenge.update({ where: { id: row.id }, data: { usedAt: new Date() } });
          return;
        }
        const link = new URL(
          row.kind === 'VERIFY_EMAIL' ? '/verify-email' : '/reset-password',
          readEnvironment().WEB_URL,
        );
        link.hash = new URLSearchParams({
          token: emailToken(row.id, row.nonce, row.kind, readEnvironment().JWT_ACCESS_SECRET),
        }).toString();
        try {
          await this.transport.sendMail({
            from: 'Чайний елемент <account@tea-element.test>',
            to: row.user.email,
            subject:
              row.kind === 'VERIFY_EMAIL'
                ? 'Підтвердьте email — Чайний елемент'
                : 'Відновлення пароля — Чайний елемент',
            messageId: `<account-${row.id}@tea-element.test>`,
            text: `${row.kind === 'VERIFY_EMAIL' ? 'Підтвердьте email облікового запису' : 'Задайте новий пароль'}: ${link.href}
Посилання приватне й одноразове. Якщо ви не надсилали цей запит, не переходьте за посиланням. Це демонстраційний магазин.`,
          });
          await tx.emailChallenge.update({
            where: { id: row.id },
            data: { mailedAt: new Date(), attempts: { increment: 1 } },
          });
        } catch {
          await tx.emailChallenge.update({
            where: { id: row.id },
            data: {
              attempts: { increment: 1 },
              nextAttemptAt: new Date(
                Date.now() + Math.min(300000, 1000 * 2 ** Math.min(row.attempts, 8)),
              ),
            },
          });
        }
      },
      { timeout: 10000 },
    );
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
    this.transport.close();
  }
}
