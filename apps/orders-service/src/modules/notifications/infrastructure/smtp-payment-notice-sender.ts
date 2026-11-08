import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { readEnvironment } from '../../../config/environment';
import { PaymentNoticeSender, type PaymentNotice } from '../domain/payment-notice';
import { paymentNoticeTemplate } from './payment-notice-template';
@Injectable()
export class SmtpPaymentNoticeSender extends PaymentNoticeSender implements OnModuleDestroy {
  private readonly transport = createTransport(readEnvironment().SMTP_URL, {
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });
  async send(notice: PaymentNotice) {
    await this.transport.sendMail({
      from: 'Чайний елемент <orders@tea-element.test>',
      to: notice.email,
      messageId: `<payment-notice-${notice.id}@tea-element.test>`,
      ...paymentNoticeTemplate(notice),
    });
  }
  onModuleDestroy() {
    this.transport.close();
  }
}
