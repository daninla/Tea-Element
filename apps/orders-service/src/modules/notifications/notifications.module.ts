import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentNoticeStore, PaymentNoticeSender } from './domain/payment-notice';
import { DeliverPaymentNotice } from './application/deliver-payment-notice';
import { PrismaPaymentNoticeStore } from './infrastructure/prisma-payment-notice-store';
import { SmtpPaymentNoticeSender } from './infrastructure/smtp-payment-notice-sender';
import { PaymentNoticeWorker } from './presentation/payment-notice-worker';
@Module({
  imports: [OrdersModule],
  providers: [
    { provide: PaymentNoticeStore, useClass: PrismaPaymentNoticeStore },
    { provide: PaymentNoticeSender, useClass: SmtpPaymentNoticeSender },
    DeliverPaymentNotice,
    PaymentNoticeWorker,
  ],
})
export class NotificationsModule {}
