'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { AdminOrderDetail } from '@tea/contracts';
import { adminApi } from '@/lib/api/admin';
import { OrdersApiError } from '@/lib/api/orders';
import { Button } from '@/components/ui/button';
import { transitionFields } from './admin-order-actions';
import { inventoryAttempt, PendingInventoryOperation } from './inventory-attempt';

export function canCancelAdminOrder(order: AdminOrderDetail) {
  return (
    !order.stockDeductedAt &&
    (['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'].includes(order.status) ||
      (order.status === 'PAID' &&
        order.paymentMethod === 'ONLINE_CARD' &&
        order.paymentStatus === 'PAID'))
  );
}
export function AdminOrderCancellation({
  order,
  actorId,
}: {
  order: AdminOrderDetail;
  actorId: string;
}) {
  const t = useTranslations('admin');
  const client = useQueryClient();
  const form = useForm({ defaultValues: { reason: '', confirmed: false } });
  const gate = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const storage = `tea-order-command:${actorId}:cancel:${order.id}`;
  useEffect(() => {
    try {
      setUncertain(!!sessionStorage.getItem(storage));
    } catch {
      setNotice('cancelUnknown');
    }
  }, [storage]);
  const online = order.paymentMethod === 'ONLINE_CARD';
  if (!canCancelAdminOrder(order) && order.status !== 'CANCELLED') return null;
  return (
    <section className="notice account-form">
      <h2>{t('cancelOrder')}</h2>
      {order.status === 'CANCELLED' ? (
        <p role="status">
          {t(
            online && order.paymentStatus === 'PAID'
              ? 'refundPending'
              : online && order.paymentStatus === 'REFUNDED'
                ? 'refundDone'
                : 'cancelledSaved',
          )}
        </p>
      ) : (
        <form
          className="account-form"
          noValidate
          onSubmit={form.handleSubmit(async (raw) => {
            if (gate.current || !actorId) return;
            const parsed = transitionFields.safeParse(raw);
            if (!parsed.success) {
              setNotice('actionInvalid');
              return;
            }
            gate.current = true;
            setBusy(true);
            setNotice('');
            const input = {
              id: order.id,
              status: 'CANCELLED' as const,
              expectedStatus: order.status,
              reason: parsed.data.reason,
            };
            try {
              const attempt = await inventoryAttempt(input, sessionStorage.getItem(storage), () =>
                crypto.randomUUID(),
              );
              sessionStorage.setItem(storage, JSON.stringify(attempt));
              const changed = await adminApi.transition({ ...input, key: attempt.key });
              sessionStorage.removeItem(storage);
              setUncertain(false);
              form.reset();
              client.setQueriesData<AdminOrderDetail>({ queryKey: ['admin-order'] }, (old) =>
                old?.id === changed.id ? changed : old,
              );
              await Promise.all([
                client.invalidateQueries({ queryKey: ['admin-orders'] }),
                client.invalidateQueries({ queryKey: ['account-orders'] }),
                client.invalidateQueries({ queryKey: ['order', order.number] }),
                client.invalidateQueries({ queryKey: ['admin-stock', order.id] }),
              ]);
            } catch (error) {
              if (error instanceof OrdersApiError && error.status >= 400 && error.status < 500) {
                sessionStorage.removeItem(storage);
                setUncertain(false);
                setNotice(error.status === 409 ? 'actionConflict' : 'actionInvalid');
              } else {
                setUncertain(true);
                setNotice(
                  error instanceof PendingInventoryOperation ? 'cancelDifferent' : 'cancelUnknown',
                );
              }
            } finally {
              gate.current = false;
              setBusy(false);
            }
          })}
        >
          <p>{t(online ? 'cancelOnlineHint' : 'cancelCodHint')}</p>
          <fieldset disabled={busy}>
            <label className="commerce-field">
              {t('actionReason')}
              <textarea {...form.register('reason')} rows={3} maxLength={500} />
            </label>
            <label className="account-check">
              <input type="checkbox" {...form.register('confirmed')} />
              {t(online ? 'confirmCancel' : 'confirmCancelCod')}
            </label>
            <Button type="submit">{t(busy ? 'working' : 'cancelOrder')}</Button>
          </fieldset>
        </form>
      )}
      {notice && <p role="alert">{t(notice)}</p>}
      {uncertain && (
        <label className="account-check">
          <input
            type="checkbox"
            onChange={(e) => {
              if (e.target.checked) {
                sessionStorage.removeItem(storage);
                setUncertain(false);
                setNotice('');
                form.reset();
              }
            }}
          />
          {t('cancelReviewed')}
        </label>
      )}
      {online && (
        <Link className="text-link" href={'/admin/payments?q=' + encodeURIComponent(order.number)}>
          {t('openPayments')}
        </Link>
      )}
    </section>
  );
}
