import { Inject, Injectable } from '@nestjs/common';
import { PaymentNoticeStore, PaymentNoticeSender } from '../domain/payment-notice';
@Injectable()
export class DeliverPaymentNotice {
  constructor(
    @Inject(PaymentNoticeStore) private readonly store: PaymentNoticeStore,
    @Inject(PaymentNoticeSender) private readonly sender: PaymentNoticeSender,
  ) {}
  async execute() {
    const notice = await this.store.claim();
    if (!notice) return false;
    let sent = false;
    try {
      await this.sender.send(notice);
      sent = true;
    } catch {
      // SMTP errors may contain addresses or private links; persist only delivery outcome.
    }
    await this.store.finish(notice.id, notice.leaseId, sent);
    return true;
  }
}
