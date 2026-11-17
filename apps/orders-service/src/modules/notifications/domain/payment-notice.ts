export type PaymentNoticeKind = 'RECEIVED' | 'REFUNDED' | 'SHIPPED' | 'COMPLETED';
interface Notice {
  id: string;
  leaseId: string;
  orderNumber: string;
  email: string;
  amount: number;
  currency: string;
  link: string;
}
export type PaymentNotice = Notice &
  (
    | { kind: PaymentNoticeKind; paymentId: string | null; firstName: string }
    | { kind: 'OWNER_NEW_ORDER'; online: boolean }
  );
export abstract class PaymentNoticeStore {
  abstract claim(): Promise<PaymentNotice | null>;
  abstract finish(id: string, leaseId: string, sent: boolean): Promise<void>;
}
export abstract class PaymentNoticeSender {
  abstract send(notice: PaymentNotice): Promise<void>;
}
