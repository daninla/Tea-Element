'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type {
  InventoryItem,
  InventoryCommandResult,
  PurchaseInput,
  AdjustmentInput,
} from '@tea/contracts';
import { inventoryApi } from '@/lib/api/inventory';
import { OrdersApiError } from '@/lib/api/orders';
import { Button } from '@/components/ui/button';
import { localDay } from './order-filters';
import { purchaseFields, adjustmentFields } from './inventory-schema';
import { inventoryAttempt, PendingInventoryOperation } from './inventory-attempt';
export function InventoryCommandForm({
  item,
  actorId,
  mode,
}: {
  item: InventoryItem;
  actorId: string;
  mode: 'PURCHASE' | 'ADJUST';
}) {
  const t = useTranslations('inventory');
  const client = useQueryClient();
  const form = useForm({
    defaultValues: {
      quantity: '',
      price: '',
      supplier: '',
      date: '',
      note: '',
      reason: '',
      operation: 'DECREASE',
      confirmed: false,
    },
  });
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null),
    [uncertain, setUncertain] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const gate = useRef(false);
  const previousStock = useRef(item.stock);
  const storageKey = `tea-inventory-command:${actorId}:${item.productId}:${mode}`;
  useEffect(() => {
    form.setValue('date', localDay(new Date()));
    try {
      setUncertain(!!sessionStorage.getItem(storageKey));
    } catch {
      setNotice('storageError');
    }
  }, [storageKey, form]);
  useEffect(() => {
    if (previousStock.current !== item.stock) {
      previousStock.current = item.stock;
      form.setValue('confirmed', false);
    }
  }, [item.stock, form]);
  async function submit(raw: unknown) {
    if (gate.current) return;
    setNotice(null);
    const purchase = mode === 'PURCHASE' ? purchaseFields.safeParse(raw) : null;
    const adjustment = mode === 'ADJUST' ? adjustmentFields.safeParse(raw) : null;
    if ((purchase && !purchase.success) || (adjustment && !adjustment.success)) {
      setNotice('invalid');
      return;
    }
    const data: Omit<PurchaseInput, 'key'> | Omit<AdjustmentInput, 'key'> | null = purchase?.success
      ? {
          productId: item.productId,
          quantity: purchase.data.quantity,
          purchasePriceTotal: purchase.data.price,
          supplier: purchase.data.supplier,
          purchasedAt: new Date(purchase.data.date + 'T00:00:00').toISOString(),
          note: purchase.data.note,
        }
      : adjustment?.success
        ? {
            productId: item.productId,
            delta:
              adjustment.data.operation === 'INCREASE'
                ? adjustment.data.quantity
                : -adjustment.data.quantity,
            kind:
              adjustment.data.operation === 'WRITE_OFF'
                ? ('WRITE_OFF' as const)
                : ('ADJUSTMENT' as const),
            expectedStock: item.stock,
            reason: adjustment.data.reason,
          }
        : null;
    if (!data) return;
    gate.current = true;
    setBusy(true);
    try {
      const attempt = await inventoryAttempt(
        { actorId, ...data },
        sessionStorage.getItem(storageKey),
        () => crypto.randomUUID(),
      );
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      let result: InventoryCommandResult;
      try {
        result =
          'quantity' in data
            ? await inventoryApi.purchase({ ...data, key: attempt.key })
            : await inventoryApi.adjust({ ...data, key: attempt.key });
      } catch (error) {
        if (error instanceof OrdersApiError && error.status < 500) {
          sessionStorage.removeItem(storageKey);
          setUncertain(false);
        } else setUncertain(true);
        throw error;
      }
      sessionStorage.removeItem(storageKey);
      setUncertain(false);
      setReviewed(false);
      setNotice('saved');
      form.reset({
        quantity: '',
        price: '',
        supplier: '',
        date: localDay(new Date()),
        note: '',
        reason: '',
        operation: 'DECREASE',
        confirmed: false,
      });
      await client.invalidateQueries({ queryKey: ['inventory-item', item.productId] });
      await client.invalidateQueries({ queryKey: ['inventory-list'] });
      await client.invalidateQueries({ queryKey: ['inventory-history', item.productId] });
      return result;
    } catch (error) {
      setNotice(
        error instanceof PendingInventoryOperation
          ? 'pendingDifferent'
          : error instanceof OrdersApiError
            ? error.code === 'INSUFFICIENT_STOCK'
              ? 'reservedError'
              : error.code === 'STOCK_CONFLICT'
                ? 'staleError'
                : error.status < 500
                  ? 'invalid'
                  : 'uncertainError'
            : 'uncertainError',
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="notice inventory-operation">
      <summary>{t(mode === 'PURCHASE' ? 'purchase' : 'adjust')}</summary>
      <form className="account-form" noValidate onSubmit={form.handleSubmit(submit)}>
        <fieldset disabled={busy}>
          <p>{t('unitHint', { unit: t(item.unit === 'GRAM' ? 'grams' : 'pieces') })}</p>
          {mode === 'ADJUST' && (
            <label className="commerce-field">
              {t('operation')}
              <select {...form.register('operation')}>
                <option value="DECREASE">{t('decrease')}</option>
                <option value="INCREASE">{t('increase')}</option>
                <option value="WRITE_OFF">{t('writeOff')}</option>
              </select>
            </label>
          )}
          <label className="commerce-field">
            {t('quantity')}
            <input {...form.register('quantity')} inputMode="numeric" maxLength={9} />
          </label>
          {mode === 'PURCHASE' ? (
            <>
              <label className="commerce-field">
                {t('cost')}
                <input {...form.register('price')} inputMode="decimal" maxLength={16} />
              </label>
              <label className="commerce-field">
                {t('supplier')}
                <input {...form.register('supplier')} maxLength={200} />
              </label>
              <label className="commerce-field">
                {t('purchaseDate')}
                <input {...form.register('date')} type="date" />
              </label>
              <label className="commerce-field">
                {t('note')}
                <textarea {...form.register('note')} rows={3} maxLength={500} />
              </label>
            </>
          ) : (
            <label className="commerce-field">
              {t('reason')}
              <textarea {...form.register('reason')} rows={3} maxLength={500} />
            </label>
          )}
          <label className="account-check">
            <input type="checkbox" {...form.register('confirmed')} />
            {t('confirm')}
          </label>
          {notice && <p role={notice === 'saved' ? 'status' : 'alert'}>{t(notice)}</p>}
          <Button type="submit" disabled={busy}>
            {t(busy ? 'working' : 'save')}
          </Button>
        </fieldset>
      </form>
      {uncertain && (
        <div className="inventory-uncertain">
          <p role="status">{t('pendingHint')}</p>
          <label className="account-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t('reviewed')}
          </label>
          <Button
            variant="outline"
            disabled={!reviewed || busy}
            onClick={() => {
              try {
                sessionStorage.removeItem(storageKey);
                setUncertain(false);
                setReviewed(false);
                setNotice(null);
                form.reset({
                  quantity: '',
                  price: '',
                  supplier: '',
                  date: localDay(new Date()),
                  note: '',
                  reason: '',
                  operation: 'DECREASE',
                  confirmed: false,
                });
              } catch {
                setNotice('storageError');
              }
            }}
          >
            {t('newOperation')}
          </Button>
        </div>
      )}
    </details>
  );
}
