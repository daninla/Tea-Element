import type {
  AdminPaymentsRead,
  AdminPaymentPage,
  AdminPaymentDetail,
  AdminPaymentEvents,
  AdminPaymentCommands,
  AdminReconciliation,
  ReconciliationReceipt,
} from '@tea/contracts';
import { request } from './orders';
export const paymentAdminApi = {
  list: (x: Extract<AdminPaymentsRead, { kind: 'LIST' }>) => {
    const { kind, ...fields } = x;
    void kind;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) p.set(k, String(v));
    return request<AdminPaymentPage>('/admin/payments?' + p);
  },
  detail: (id: string) => request<AdminPaymentDetail>('/admin/payments/' + id),
  events: (page: number, paymentId?: string, signatureValid?: boolean) =>
    request<AdminPaymentEvents>(
      '/admin/payments/events?' +
        new URLSearchParams({
          page: String(page),
          ...(paymentId ? { paymentId } : {}),
          ...(signatureValid !== undefined ? { signatureValid: String(signatureValid) } : {}),
        }),
    ),
  commands: (id: string, page: number) =>
    request<AdminPaymentCommands>(`/admin/payments/${id}/commands?page=${page}`),
  reconcile: ({ key, paymentId, ...input }: AdminReconciliation) =>
    request<ReconciliationReceipt>(
      '/admin/payments/' + paymentId + '/reconcile',
      'POST',
      input,
      key,
    ),
};
