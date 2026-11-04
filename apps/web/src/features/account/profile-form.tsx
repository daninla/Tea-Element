'use client';
import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { PublicUser } from '@tea/contracts';
import { authApi } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';
import { profileFields } from './account-schema';
export function ProfileForm({ user }: { user: PublicUser }) {
  const t = useTranslations('account');
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const gate = useRef(false);
  const form = useForm({
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      saveDelivery: !!user.defaultDelivery,
      delivery: user.defaultDelivery ?? { method: 'PICKUP' as const, city: '', address: '' },
    },
  });
  async function save(raw: unknown) {
    if (gate.current) return;
    const parsed = profileFields.safeParse(raw);
    if (!parsed.success) {
      setStatus('error');
      return;
    }
    gate.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const { firstName, lastName, phone, saveDelivery, delivery } = parsed.data;
      const updated = await authApi.profile({
        firstName,
        lastName,
        phone: phone || null,
        defaultDelivery: saveDelivery ? delivery : null,
      });
      client.setQueryData(['customer-session'], updated);
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="account-form" onSubmit={form.handleSubmit(save)} noValidate>
      <fieldset disabled={busy}>
        <legend>{t('profile')}</legend>
        {(['firstName', 'lastName', 'phone'] as const).map((field) => (
          <label className="commerce-field" key={field}>
            {t(field)}
            <input
              {...form.register(field)}
              type={field === 'phone' ? 'tel' : 'text'}
              maxLength={100}
            />
          </label>
        ))}
        <label className="account-check">
          <input type="checkbox" {...form.register('saveDelivery')} />
          {t('saveDelivery')}
        </label>
        {form.watch('saveDelivery') && (
          <>
            <label className="commerce-field">
              {t('deliveryMethod')}
              <select {...form.register('delivery.method')}>
                <option value="PICKUP">{t('pickup')}</option>
                <option value="NOVA_POSHTA_BRANCH">{t('branch')}</option>
                <option value="NOVA_POSHTA_COURIER">{t('courier')}</option>
              </select>
            </label>
            {form.watch('delivery.method') !== 'PICKUP' && (
              <>
                <label className="commerce-field">
                  {t('city')}
                  <input {...form.register('delivery.city')} maxLength={100} />
                </label>
                <label className="commerce-field">
                  {t('address')}
                  <input {...form.register('delivery.address')} maxLength={300} />
                </label>
              </>
            )}
          </>
        )}
        <Button disabled={busy} type="submit">
          {t(busy ? 'working' : 'save')}
        </Button>
        {status && <p role={status === 'error' ? 'alert' : 'status'}>{t(status)}</p>}
      </fieldset>
    </form>
  );
}
