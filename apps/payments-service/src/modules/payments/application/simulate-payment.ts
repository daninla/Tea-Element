import { Inject, Injectable } from '@nestjs/common';
import type { PaymentAccess, OrdersRequest, PaymentCheckoutView } from '@tea/contracts';
import { readEnvironment } from '../../../config/environment';
import { PaymentError } from '../domain/payment-store';
import { PaymentSimulator } from '../domain/payment-simulator';
import { GetPayment } from './get-payment';
import { RecordWebhook } from './record-webhook';
@Injectable()
export class SimulatePayment {
  constructor(
    @Inject(GetPayment) private readonly get: GetPayment,
    @Inject(PaymentSimulator) private readonly simulator: PaymentSimulator,
    @Inject(RecordWebhook) private readonly record: RecordWebhook,
  ) {}
  async execute(request: OrdersRequest<PaymentAccess>, outcome: 'SUCCEEDED' | 'FAILED') {
    const env = readEnvironment();
    if (env.PAYMENT_PROVIDER !== 'fake' || env.NODE_ENV === 'production')
      throw new PaymentError('SIMULATION_DISABLED', 404);
    const prepared = (await this.get.execute(request, true)) as PaymentCheckoutView;
    const raw = this.simulator.settle(prepared.payment.id, outcome);
    return this.record.execute(raw, request.context.correlationId);
  }
}
