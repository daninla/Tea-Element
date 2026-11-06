'use client';
import { AdminTable, AdminTableScroll } from './admin-table';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { AdminPromotion, PromotionTargetInput } from '@tea/contracts';
import { catalogAdminApi } from '@/lib/api/catalog-admin';
import { Button } from '@/components/ui/button';
import { CatalogAudit } from './catalog-audit';
import { useCatalogSave } from './use-catalog-save';
import { promotionFields, localDateTime } from './promotion-schema';
export function PromotionAdminPage() {
  const t = useTranslations('promotionAdmin'),
    client = useQueryClient();
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [active, setActive] = useState(''),
    [current, setCurrent] = useState<AdminPromotion>(),
    [generation, setGeneration] = useState(0),
    [saved, setSaved] = useState(false),
    [refreshError, setRefreshError] = useState(false);
  const filters = useForm({ defaultValues: { q: '', active: '' } });
  const params = new URLSearchParams({
    page: String(page),
    ...(q ? { q } : {}),
    ...(active ? { active } : {}),
  });
  const list = useQuery({
    queryKey: ['admin-promotions', params.toString()],
    queryFn: () => catalogAdminApi.promotions(params.toString()),
    retry: false,
  });
  async function refresh() {
    setRefreshError(false);
    try {
      if (current) {
        setCurrent(await catalogAdminApi.promotion(current.id));
        setGeneration((n) => n + 1);
      }
      await list.refetch();
    } catch {
      setRefreshError(true);
    }
  }
  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <form
        className="admin-filters"
        onSubmit={filters.handleSubmit((x) => {
          setQ(x.q.trim());
          setActive(x.active);
          setPage(1);
        })}
      >
        <label className="commerce-field">
          {t('search')}
          <input type="search" maxLength={100} {...filters.register('q')} />
        </label>
        <label className="commerce-field">
          {t('enabled')}
          <select {...filters.register('active')}>
            <option value="">{t('all')}</option>
            <option value="true">{t('yes')}</option>
            <option value="false">{t('no')}</option>
          </select>
        </label>
        <div className="account-links">
          <Button type="submit">{t('search')}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              filters.reset();
              setQ('');
              setActive('');
              setPage(1);
            }}
          >
            {t('reset')}
          </Button>
        </div>
      </form>
      <Button
        variant="outline"
        onClick={() => {
          setCurrent(undefined);
          setGeneration((n) => n + 1);
          setSaved(false);
        }}
      >
        {t('new')}
      </Button>
      {list.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : list.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        list.data && (
          <>
            <p>{t('found', { count: list.data.total })}</p>
            <AdminTableScroll label={t('title')}>
              <table className="admin-table">
                <caption>{t('title')}</caption>
                <thead>
                  <tr>
                    {['name', 'discount', 'period', 'enabled', 'edit'].map((x) => (
                      <th scope="col" key={x}>
                        {t(x)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((x) => (
                    <tr key={x.id}>
                      <th scope="row">{x.name}</th>
                      <td className="admin-numeric">
                        {x.type === 'PERCENT'
                          ? x.value + '%'
                          : (x.value / 100).toLocaleString('uk-UA', {
                              style: 'currency',
                              currency: 'UAH',
                            })}
                      </td>
                      <td>
                        <time dateTime={x.startsAt}>
                          {new Date(x.startsAt).toLocaleString('uk-UA')}
                        </time>
                        <br />
                        <time dateTime={x.endsAt}>
                          {new Date(x.endsAt).toLocaleString('uk-UA')}
                        </time>
                      </td>
                      <td>
                        {t(
                          !x.isActive
                            ? 'disabled'
                            : Date.now() < new Date(x.startsAt).getTime()
                              ? 'scheduled'
                              : Date.now() >= new Date(x.endsAt).getTime()
                                ? 'ended'
                                : 'running',
                        )}
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCurrent(x);
                            setGeneration((n) => n + 1);
                            setSaved(false);
                          }}
                        >
                          {t('edit')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableScroll>
            {!list.data.items.length && <p>{t('empty')}</p>}
            <nav className="account-links" aria-label={t('pagination')}>
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </Button>
              <span>
                {page} / {list.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= list.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          </>
        )
      )}
      <Button variant="outline" disabled={list.isFetching} onClick={() => void refresh()}>
        {t('refresh')}
      </Button>
      {refreshError && <p role="alert">{t('error')}</p>}
      {saved && <p role="status">{t('saved')}</p>}
      <PromotionForm
        key={generation}
        current={current}
        saved={async (x) => {
          setCurrent(x);
          setGeneration((n) => n + 1);
          setSaved(true);
          await client.invalidateQueries({ queryKey: ['admin-promotions'] });
        }}
      />
      {current && <CatalogAudit key={current.id + ':' + current.revision} id={current.id} />}
    </>
  );
}
function PromotionForm({
  current,
  saved,
}: {
  current?: AdminPromotion;
  saved: (x: AdminPromotion) => Promise<void>;
}) {
  const t = useTranslations('promotionAdmin'),
    common = useTranslations('catalogAdmin'),
    command = useCatalogSave('promotion:' + (current?.id ?? 'new'));
  const [invalid, setInvalid] = useState(false);
  const [targets, setTargets] = useState<(PromotionTargetInput & { name: string })[]>(
      current?.targets ?? [],
    ),
    [kind, setKind] = useState<'PRODUCT' | 'CATEGORY'>('PRODUCT'),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const form = useForm<{
    name: string;
    type: 'PERCENT' | 'FIXED';
    value: string;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  }>({
    defaultValues: {
      name: current?.name ?? '',
      type: current?.type ?? 'PERCENT',
      value: current
        ? current.type === 'PERCENT'
          ? String(current.value)
          : `${Math.floor(current.value / 100)}.${String(current.value % 100).padStart(2, '0')}`
        : '',
      startsAt: localDateTime(current?.startsAt ?? new Date().toISOString()),
      endsAt: localDateTime(current?.endsAt ?? new Date(Date.now() + 7 * 86400000).toISOString()),
      isActive: current?.isActive ?? false,
    },
  });
  const options = useQuery({
    queryKey: ['promotion-targets', kind, search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), q: search });
      return kind === 'PRODUCT'
        ? catalogAdminApi.products(p.toString())
        : catalogAdminApi.categories(p.toString());
    },
    retry: false,
  });
  return (
    <form
      className="commerce-card catalog-editor"
      onSubmit={form.handleSubmit(async (raw) => {
        const parsed = promotionFields.safeParse(raw);
        setInvalid(!parsed.success || !targets.length);
        if (!parsed.success || !targets.length) return;
        const input = { ...parsed.data, targets: targets.map(({ kind, id }) => ({ kind, id })) };
        const result = await command.save({ input, revision: current?.revision }, (key) =>
          catalogAdminApi.savePromotion(input, key, current),
        );
        if (result) await saved(result);
      })}
    >
      <h2>{t(current ? 'edit' : 'new')}</h2>
      <fieldset disabled={command.busy}>
        <label className="commerce-field">
          {t('name')}
          <input {...form.register('name')} maxLength={200} required />
        </label>
        <label className="commerce-field">
          {t('type')}
          <select {...form.register('type')}>
            <option value="PERCENT">{t('percent')}</option>
            <option value="FIXED">{t('fixed')}</option>
          </select>
        </label>
        <label className="commerce-field">
          {t(form.watch('type') === 'PERCENT' ? 'percentValue' : 'fixedValue')}
          <input inputMode="decimal" {...form.register('value')} required />
        </label>
        <p>{t('timeHint', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
        {(['startsAt', 'endsAt'] as const).map((x) => (
          <label className="commerce-field" key={x}>
            {t(x)}
            <input type="datetime-local" {...form.register(x)} required />
          </label>
        ))}
        <label className="account-check">
          <input type="checkbox" {...form.register('isActive')} />
          {t('enabled')}
        </label>
        <p>{t('rules')}</p>
        <h3>{t('targets')}</h3>
        <AdminTable
          caption={t('targets')}
          headings={[t('targetKind'), t('targetName'), t('actions')]}
        >
          {targets.map((x, i) => (
            <tr key={x.kind + ':' + x.id}>
              <td>{t(x.kind)}</td>
              <th scope="row">{x.name}</th>
              <td>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTargets(targets.filter((_, n) => n !== i))}
                >
                  {t('remove')}
                </Button>
              </td>
            </tr>
          ))}
        </AdminTable>
        {!targets.length && <p>{t('chooseTarget')}</p>}
        <label className="commerce-field">
          {t('targetKind')}
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as 'PRODUCT' | 'CATEGORY');
              setPage(1);
            }}
          >
            <option value="PRODUCT">{t('PRODUCT')}</option>
            <option value="CATEGORY">{t('CATEGORY')}</option>
          </select>
        </label>
        <label className="commerce-field">
          {t('targetSearch')}
          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setSearch(query.trim());
                setPage(1);
              }
            }}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearch(query.trim());
            setPage(1);
          }}
        >
          {t('search')}
        </Button>
        {options.isPending ? (
          <p role="status">{t('loading')}</p>
        ) : options.isError ? (
          <>
            <p role="alert">{t('error')}</p>
            <Button type="button" onClick={() => void options.refetch()}>
              {t('refresh')}
            </Button>
          </>
        ) : (
          options.data && (
            <>
              <label className="commerce-field">
                {t('addTarget')}
                <select
                  value=""
                  disabled={targets.length >= 50}
                  onChange={(e) => {
                    const x = options.data?.items.find((x) => x.id === e.target.value);
                    if (x && !targets.some((t) => t.kind === kind && t.id === x.id))
                      setTargets([...targets, { kind, id: x.id, name: x.name }]);
                  }}
                >
                  <option value="">{t('chooseTarget')}</option>
                  {options.data.items.map((x) => (
                    <option
                      value={x.id}
                      key={x.id}
                      disabled={targets.some((t) => t.kind === kind && t.id === x.id)}
                    >
                      {x.name}
                      {!x.isActive ? ' · ' + t('disabled') : ''}
                    </option>
                  ))}
                </select>
              </label>
              {!options.data.items.length && <p>{t('empty')}</p>}
              <div className="account-links">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t('previous')}
                </Button>
                <span>
                  {page} / {options.data.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page >= options.data.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('next')}
                </Button>
              </div>
            </>
          )
        )}
        {invalid && <p role="alert">{t('invalid')}</p>}
        {command.message && (
          <p role="alert">
            {command.message === 'invalid' ? t('invalid') : common(command.message)}
          </p>
        )}
        <Button type="submit">{t(command.busy ? 'saving' : 'save')}</Button>
      </fieldset>
      {command.uncertain && (
        <>
          <p>{common('pending')}</p>
          <label className="account-check">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  command.reviewed();
                  form.reset();
                  setTargets(current?.targets ?? []);
                }
              }}
            />
            {common('reviewed')}
          </label>
        </>
      )}
    </form>
  );
}
