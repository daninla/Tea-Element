'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MARKETING_CAMPAIGNS, EMAIL_STATUSES, type CampaignSetting } from '@tea/contracts';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { campaignAdminApi } from '@/lib/api/campaign-admin';
import { Button } from '@/components/ui/button';
import { AdminTable } from './admin-table';
import { inventoryAttempt, PendingInventoryOperation } from './inventory-attempt';
import { campaignFilterFields } from './campaign-filters';
export function CampaignToggle({
  setting,
  actorId,
}: {
  setting: CampaignSetting;
  actorId: string;
}) {
  const t = useTranslations('campaignAdmin'),
    client = useQueryClient(),
    gate = useRef(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const storage = `tea-campaign-command:${actorId}:${setting.campaign}`;
  useEffect(() => {
    try {
      setUncertain(!!sessionStorage.getItem(storage));
    } catch {
      setMessage('pending');
    }
  }, [storage]);
  return (
    <>
      <Button
        disabled={busy}
        type="button"
        onClick={async () => {
          if (gate.current) return;
          gate.current = true;
          setBusy(true);
          setMessage('');
          const input = {
            campaign: setting.campaign,
            enabled: !setting.enabled,
            expectedRevision: setting.revision,
          };
          try {
            const attempt = await inventoryAttempt(input, sessionStorage.getItem(storage), () =>
              crypto.randomUUID(),
            );
            sessionStorage.setItem(storage, JSON.stringify(attempt));
            const result = await campaignAdminApi.configure({ ...input, key: attempt.key });
            sessionStorage.removeItem(storage);
            setUncertain(false);
            client.setQueryData<CampaignSetting[]>(['campaign-settings'], (old) =>
              old?.map((x) => (x.campaign === result.campaign ? result : x)),
            );
            await Promise.all([
              client.invalidateQueries({ queryKey: ['campaign-settings'] }),
              client.invalidateQueries({ queryKey: ['campaign-logs'] }),
            ]);
            setMessage('saved');
          } catch (e) {
            if (e instanceof OrdersApiError && e.status >= 400 && e.status < 500) {
              sessionStorage.removeItem(storage);
              setUncertain(false);
              setMessage(e.status === 409 ? 'stale' : 'error');
            } else {
              setUncertain(true);
              setMessage(e instanceof PendingInventoryOperation ? 'pendingDifferent' : 'pending');
            }
          } finally {
            gate.current = false;
            setBusy(false);
          }
        }}
      >
        {t(busy ? 'saving' : setting.enabled ? 'disable' : 'enable')}
      </Button>
      {message && <p role="status">{t(message)}</p>}
      {uncertain && (
        <label className="account-check">
          <input
            type="checkbox"
            disabled={busy}
            onChange={(e) => {
              if (e.target.checked) {
                sessionStorage.removeItem(storage);
                setUncertain(false);
                setMessage('');
              }
            }}
          />
          {t('reviewed')}
        </label>
      )}
    </>
  );
}
export function AdminCampaignsPage() {
  const t = useTranslations('campaignAdmin'),
    session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false }),
    settings = useQuery({
      queryKey: ['campaign-settings'],
      queryFn: campaignAdminApi.settings,
      refetchOnWindowFocus: false,
    }),
    form = useForm({ defaultValues: { q: '', campaign: '', status: '' } }),
    [filters, setFilters] = useState({ q: '', campaign: '', status: '' }),
    [page, setPage] = useState(1),
    [invalid, setInvalid] = useState(false);
  const parsed = campaignFilterFields.parse(filters),
    logs = useQuery({
      queryKey: ['campaign-logs', filters, page],
      queryFn: () =>
        campaignAdminApi.logs({
          kind: 'LOGS',
          page,
          ...(parsed.q ? { q: parsed.q } : {}),
          ...(parsed.campaign ? { campaign: parsed.campaign } : {}),
          ...(parsed.status ? { status: parsed.status } : {}),
        }),
    });
  const date = (x: string | null) =>
    x
      ? new Intl.DateTimeFormat('uk-UA', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'Europe/Kyiv',
        }).format(new Date(x))
      : '—';
  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('note')}</p>
      <Button
        type="button"
        onClick={() => {
          void settings.refetch();
          void logs.refetch();
        }}
      >
        {t('refresh')}
      </Button>
      {settings.isPending && <p role="status">{t('loading')}</p>}
      {settings.isError && <p role="alert">{t('error')}</p>}
      {settings.data && (
        <AdminTable caption={t('rules')} headings={[t('rule'), t('state'), t('action')]}>
          {settings.data.map((x) => (
            <tr key={x.campaign}>
              <th scope="row">
                {t(x.campaign)}
                <p>{t(x.campaign + 'Note')}</p>
              </th>
              <td>{t(x.enabled ? 'enabled' : 'disabled')}</td>
              <td>
                {session.data?.role === 'ADMIN' && (
                  <CampaignToggle setting={x} actorId={session.data.id} />
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      <h2>{t('journal')}</h2>
      <form
        className="admin-filters"
        onSubmit={form.handleSubmit((raw) => {
          const x = campaignFilterFields.safeParse(raw);
          setInvalid(!x.success);
          if (x.success) {
            setFilters(x.data);
            setPage(1);
          }
        })}
      >
        <label className="commerce-field">
          {t('email')}
          <input {...form.register('q')} maxLength={100} />
        </label>
        <label className="commerce-field">
          {t('rule')}
          <select {...form.register('campaign')}>
            <option value="">{t('all')}</option>
            {MARKETING_CAMPAIGNS.map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="commerce-field">
          {t('state')}
          <select {...form.register('status')}>
            <option value="">{t('all')}</option>
            {EMAIL_STATUSES.map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">{t('filter')}</Button>
        <Button
          type="button"
          onClick={() => {
            form.reset();
            setFilters({ q: '', campaign: '', status: '' });
            setPage(1);
            setInvalid(false);
          }}
        >
          {t('reset')}
        </Button>
      </form>
      {invalid && <p role="alert">{t('invalid')}</p>}
      {logs.isPending && <p role="status">{t('loading')}</p>}
      {logs.isError && <p role="alert">{t('error')}</p>}
      {logs.data && (
        <>
          <p role="status">{t('total', { count: logs.data.total })}</p>
          <AdminTable
            caption={t('journal')}
            headings={[t('created'), t('email'), t('rule'), t('state'), t('attempts'), t('sent')]}
          >
            {logs.data.items.length ? (
              logs.data.items.map((x) => (
                <tr key={x.id}>
                  <td>{date(x.createdAt)}</td>
                  <td>{x.email}</td>
                  <td>
                    {t(x.campaign)}
                    {x.promotionTitle && <p>{x.promotionTitle}</p>}
                  </td>
                  <td>{t(x.status)}</td>
                  <td>{x.attempts}</td>
                  <td>{date(x.sentAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>{t('empty')}</td>
              </tr>
            )}
          </AdminTable>
          <nav aria-label={t('pages')}>
            <Button type="button" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>
              {t('previous')}
            </Button>
            <span>
              {' '}
              {page} / {logs.data.totalPages}{' '}
            </span>
            <Button
              type="button"
              disabled={page >= logs.data.totalPages}
              onClick={() => setPage((x) => x + 1)}
            >
              {t('next')}
            </Button>
          </nav>
        </>
      )}
    </>
  );
}
