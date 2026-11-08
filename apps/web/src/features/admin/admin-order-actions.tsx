'use client';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import type { AdminOrderDetail, AdminOrderTransition } from '@tea/contracts';
import { adminApi } from '@/lib/api/admin';
import { OrdersApiError } from '@/lib/api/orders';
import { Button } from '@/components/ui/button';
export const transitionFields = z.object({
  reason: z.string().trim().min(3).max(500),
  confirmed: z.literal(true),
});
export function AdminOrderActions({ order }: { order: AdminOrderDetail }) {
  const t = useTranslations('admin');
  const client = useQueryClient();
  const form = useForm({ defaultValues: { reason: '', confirmed: false } });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const gate = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const ship =
    (order.status === 'CONFIRMED' &&
      order.paymentMethod === 'CASH_ON_DELIVERY' &&
      order.paymentStatus === 'UNPAID') ||
    (order.status === 'PAID' &&
      order.paymentMethod === 'ONLINE_CARD' &&
      order.paymentStatus === 'PAID');
  const complete =
    order.status === 'SHIPPED' &&
    !!order.stockDeductedAt &&
    (order.paymentMethod === 'CASH_ON_DELIVERY'
      ? ['UNPAID', 'PAID'].includes(order.paymentStatus ?? '')
      : order.paymentStatus === 'PAID');
  const action = ship ? 'SHIPPED' : complete ? 'COMPLETED' : null;
  async function submit(raw: unknown) {
    if (gate.current || !action) return;
    const parsed = transitionFields.safeParse(raw);
    if (!parsed.success) {
      setNotice('actionInvalid');
      return;
    }
    gate.current = true;
    setBusy(true);
    setNotice(null);
    const fingerprint = JSON.stringify({
      id: order.id,
      status: action,
      expectedStatus: order.status,
      reason: parsed.data.reason,
    });
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const input: AdminOrderTransition = {
        id: order.id,
        status: action,
        expectedStatus: order.status,
        reason: parsed.data.reason,
        key: attempt.current.key,
      };
      const changed = await adminApi.transition(input);
      client.setQueriesData<AdminOrderDetail>({ queryKey: ['admin-order'] }, (old) =>
        old?.id === changed.id ? changed : old,
      );
      await client.invalidateQueries({ queryKey: ['admin-orders'] });
      await client.invalidateQueries({ queryKey: ['account-orders'] });
      await client.invalidateQueries({ queryKey: ['order', order.number] });
      form.reset();
      attempt.current = undefined;
      setNotice('actionSaved');
    } catch (error) {
      setNotice(
        error instanceof OrdersApiError && error.status === 409 ? 'actionConflict' : 'actionError',
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="notice admin-actions">
      <h2>{t('actions')}</h2>
      {order.status === 'SHIPPED' && !order.stockDeductedAt && (
        <p role="status">{t('stockPending')}</p>
      )}
      {order.stockDeductedAt && <p>{t('stockDeducted')}</p>}
      {notice && <p role={notice === 'actionSaved' ? 'status' : 'alert'}>{t(notice)}</p>}
      {action ? (
        <form className="account-form" noValidate onSubmit={form.handleSubmit(submit)}>
          <fieldset disabled={busy}>
            <p>
              {t(
                action === 'SHIPPED'
                  ? 'shipHint'
                  : order.paymentMethod === 'CASH_ON_DELIVERY'
                    ? 'completeCodHint'
                    : 'completeHint',
              )}
            </p>
            <label className="commerce-field">
              {t('actionReason')}
              <textarea {...form.register('reason')} minLength={3} maxLength={500} rows={3} />
            </label>
            <label className="account-check">
              <input type="checkbox" {...form.register('confirmed')} />
              {t(action === 'SHIPPED' ? 'confirmShip' : 'confirmComplete')}
            </label>
            <Button type="submit" disabled={busy}>
              {t(busy ? 'working' : action === 'SHIPPED' ? 'ship' : 'complete')}
            </Button>
          </fieldset>
        </form>
      ) : (
        !['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT', 'SHIPPED', 'COMPLETED'].includes(
          order.status,
        ) && <p>{t('noTransitions')}</p>
      )}
    </section>
  );
}
