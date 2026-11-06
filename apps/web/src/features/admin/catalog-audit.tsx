'use client';
import { AdminTable } from './admin-table';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { catalogAdminApi } from '@/lib/api/catalog-admin';
import { Button } from '@/components/ui/button';
export function CatalogAudit({ id }: { id: string }) {
  const t = useTranslations('catalogAdmin'),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['catalog-audit', id, page],
    queryFn: () => catalogAdminApi.audit(id, page),
    retry: false,
  });
  return (
    <section className="commerce-card">
      <h2>{t('history')}</h2>
      {q.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : q.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        q.data && (
          <>
            {!q.data.items.length && <p>{t('empty')}</p>}
            <AdminTable
              caption={t('history')}
              headings={[t('recordedAt'), t('action'), t('actor')]}
            >
              {q.data.items.map((x) => (
                <tr key={x.id}>
                  <td>
                    <time dateTime={x.createdAt}>
                      {new Date(x.createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}
                    </time>
                  </td>
                  <td>{t(x.kind)}</td>
                  <td>{x.actorId}</td>
                </tr>
              ))}
            </AdminTable>
            <div className="account-links">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </Button>
              <span>
                {page} / {q.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= q.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </Button>
            </div>
          </>
        )
      )}
      <Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}>
        {t('refresh')}
      </Button>
    </section>
  );
}
