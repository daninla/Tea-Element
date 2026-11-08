export type PaymentNoticeKind = 'RECEIVED' | 'REFUNDED';
export interface PaymentNotice {
  id: string;
  leaseId: string;
  kind: PaymentNoticeKind;
  orderNumber: string;
  paymentId: string;
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
