import { Inject, Injectable } from '@nestjs/common';
import type {
  PaymentAccess,
  OrdersRequest,
  PaymentCheckoutView,
  PaymentView,
} from '@tea/contracts';
import { PaymentOrderAccess, PaymentStore, PaymentError, identity } from '../domain/payment-store';
import { PaymentProvider } from '../domain/payment-provider';
import { readEnvironment } from '../../../config/environment';
@Injectable()
export class GetPayment {
  constructor(
    @Inject(PaymentStore) private readonly store: PaymentStore,
    @Inject(PaymentProvider) private readonly provider: PaymentProvider,
    @Inject(PaymentOrderAccess) private readonly orders: PaymentOrderAccess,
  ) {}
  async execute(
    request: OrdersRequest<PaymentAccess>,
    checkout: boolean,
  ): Promise<PaymentView | PaymentCheckoutView> {
    const order = await this.orders.get(request.input, request.context);
    const payment = await this.store.forOrder(order.id);
    if (!payment) throw new PaymentError('PAYMENT_NOT_READY', 409);
    const view: PaymentView = {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      expiresAt: payment.expiresAt,
    };
    if (!checkout) return view;
    if (payment.provider !== readEnvironment().PAYMENT_PROVIDER.toUpperCase())
      throw new PaymentError('PROVIDER_NOT_ACTIVE', 409);
    if (
      order.status !== 'AWAITING_PAYMENT' ||
      order.paymentMethod !== 'ONLINE_CARD' ||
      payment.cancelRequested ||
      !['CREATED', 'PENDING'].includes(payment.status) ||
      Date.parse(payment.expiresAt) <= Date.now()
    )
      throw new PaymentError('PAYMENT_NOT_PAYABLE', 409);
    const form = await this.provider.createCheckout({
      ...identity(payment),
      orderNumber: order.number,
      expiresAt: payment.expiresAt,
      returnUrl: `${readEnvironment().CORS_ORIGIN}/order/${order.number}/result`,
    });
    return { payment: view, checkout: form };
  }
}
