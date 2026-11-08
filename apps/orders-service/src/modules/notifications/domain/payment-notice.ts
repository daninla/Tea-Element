export type PaymentNoticeKind = 'RECEIVED' | 'REFUNDED' | 'SHIPPED' | 'COMPLETED';
export interface PaymentNotice {
  id: string;
  leaseId: string;
  kind: PaymentNoticeKind;
  orderNumber: string;
  paymentId: string | null;
  email: string;
  firstName: string;
  amount: number;
  currency: string;
  link: string;
}
export abstract class PaymentNoticeStore {
  abstract claim(): Promise<PaymentNotice | null>;
  abstract finish(id: string, leaseId: string, sent: boolean): Promise<void>;
}
export abstract class PaymentNoticeSender {
  abstract send(notice: PaymentNotice): Promise<void>;
}
