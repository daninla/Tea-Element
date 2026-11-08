import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { readEnvironment } from '../../../config/environment';
import { DeliverPaymentNotice } from '../application/deliver-payment-notice';
@Injectable()
export class PaymentNoticeWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(@Inject(DeliverPaymentNotice) private readonly deliver: DeliverPaymentNotice) {}
  onModuleInit() {
    if (readEnvironment().NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.run()
          .catch(() => {})
          .finally(() => {
            this.active = undefined;
          });
    }, 2000);
    this.timer.unref();
  }
  private async run() {
    for (let i = 0; i < 10 && (await this.deliver.execute()); i++) {
      /* Bounded delivery batch. */
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
