import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { readEnvironment } from '../../../config/environment';
import { PaymentNoticeSender, type PaymentNotice } from '../domain/payment-notice';
import { paymentNoticeTemplate } from './payment-notice-template';
@Injectable()
export class SmtpPaymentNoticeSender extends PaymentNoticeSender implements OnModuleDestroy {
  private readonly env = readEnvironment();
  private readonly transport = createTransport(this.env.SMTP_URL, {
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });
  async send(notice: PaymentNotice) {
    await this.transport.sendMail({
      from: { name: 'Чайний елемент', address: this.env.SMTP_FROM_ADDRESS },
      to: notice.email,
      messageId: `<payment-notice-${notice.id}@tea-element.test>`,
      ...paymentNoticeTemplate(notice),
    });
  }
  onModuleDestroy() {
    this.transport.close();
  }
}
