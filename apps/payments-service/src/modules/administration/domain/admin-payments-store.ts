import type {
  AdminPaymentsRead,
  AdminPaymentPage,
  AdminPaymentDetail,
  AdminPaymentEvents,
  AdminPaymentCommands,
  AdminReconciliation,
  ReconciliationReceipt,
} from '@tea/contracts';
export type AdminPaymentsResult =
  AdminPaymentPage | AdminPaymentDetail | AdminPaymentEvents | AdminPaymentCommands;
export abstract class AdminPaymentsStore {
  abstract read(input: AdminPaymentsRead): Promise<AdminPaymentsResult>;
  abstract reconcile(input: AdminReconciliation, actorId: string): Promise<ReconciliationReceipt>;
}
export function canRequestReconciliation(status: string) {
  return ['CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'].includes(status);
}
