'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { AdminPayment, ReconciliationReceipt } from '@tea/contracts';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { paymentAdminApi } from '@/lib/api/payment-admin';
import { Button } from '@/components/ui/button';
import { inventoryAttempt, PendingInventoryOperation } from './inventory-attempt';
import { reconciliationFields } from './payment-admin-filters';
export function PaymentReconcileForm({
  payment,
  onQueued,
}: {
  payment: AdminPayment;
  onQueued: (r: ReconciliationReceipt) => void;
}) {
  const t = useTranslations('paymentAdmin'),
    session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false }),
    form = useForm({ defaultValues: { reason: '', confirmed: false } }),
    gate = useRef(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const storage = `tea-payment-command:${session.data?.id}:reconcile:${payment.id}`;
  useEffect(() => {
    try {
      setUncertain(!!sessionStorage.getItem(storage));
    } catch {
      setMessage('pending');
    }
  }, [storage]);
  return (
    <form
      className="notice account-form"
      onSubmit={form.handleSubmit(async (raw) => {
        if (gate.current || session.data?.role !== 'ADMIN') return;
        const parsed = reconciliationFields.safeParse(raw);
        if (!parsed.success) {
          setMessage('invalidCommand');
          return;
        }
        const input = {
          paymentId: payment.id,
          expectedStatus: payment.status,
          reason: parsed.data.reason,
        };
        gate.current = true;
        setBusy(true);
        setMessage('');
        try {
          const attempt = await inventoryAttempt(input, sessionStorage.getItem(storage), () =>
            crypto.randomUUID(),
          );
          sessionStorage.setItem(storage, JSON.stringify(attempt));
          const receipt = await paymentAdminApi.reconcile({ ...input, key: attempt.key });
          sessionStorage.removeItem(storage);
          setUncertain(false);
          form.reset();
          onQueued(receipt);
        } catch (e) {
          if (e instanceof OrdersApiError && e.status >= 400 && e.status < 500) {
            sessionStorage.removeItem(storage);
            setUncertain(false);
            setMessage(
              e.code === 'PAYMENT_STATE_CONFLICT'
                ? 'stale'
                : e.code === 'PROVIDER_NOT_ACTIVE'
                  ? 'providerInactive'
                  : 'invalidCommand',
            );
          } else {
            setUncertain(true);
            setMessage(e instanceof PendingInventoryOperation ? 'pendingDifferent' : 'pending');
          }
        } finally {
          gate.current = false;
          setBusy(false);
        }
      })}
    >
      <h2>{t('reconcile')}</h2>
      <p>{t('reconcileNote')}</p>
      <fieldset disabled={busy}>
        <label className="commerce-field">
          {t('reason')}
          <textarea {...form.register('reason')} maxLength={500} required />
        </label>
        <label className="account-check">
          <input type="checkbox" {...form.register('confirmed')} />
          {t('confirm')}
        </label>
        {message && <p role="alert">{t(message)}</p>}
        <Button type="submit">{t(busy ? 'sending' : 'request')}</Button>
      </fieldset>
      {uncertain && (
        <>
          <p>{t('pending')}</p>
          <label className="account-check">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  sessionStorage.removeItem(storage);
                  setUncertain(false);
                  setMessage('');
                  form.reset();
                }
              }}
            />
            {t('reviewed')}
          </label>
        </>
      )}
    </form>
  );
}
