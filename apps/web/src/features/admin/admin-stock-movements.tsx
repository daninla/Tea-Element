'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
export function AdminStockMovements({
  id,
  pending,
  stockDeductedAt,
}: {
  id: string;
  pending: boolean;
  stockDeductedAt: string | null;
}) {
  const t = useTranslations('admin');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin-stock', id, page, stockDeductedAt],
    queryFn: () => adminApi.movements(id, page),
    retry: false,
    refetchInterval: pending ? 2000 : false,
  });
  return (
    <section>
      <h2>{t('movements')}</h2>
      <p>{t('movementsScope')}</p>
      {query.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : query.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        query.data && (
          <>
            {!query.data.items.length ? (
              <p>{t('noMovements')}</p>
            ) : (
              <ul className="admin-history">
                {query.data.items.map((x) => (
                  <li key={x.id}>
                    <strong>
                      {x.productName} · {t(`movementTypes.${x.type}`)}
                    </strong>
                    <p>
                      {x.quantity} {t(x.unit === 'PIECE' ? 'pieces' : 'grams')} · {t('stockChange')}
                      : {x.stockDelta} · {t('reservedChange')}: {x.reservedDelta}
                    </p>
                    <time dateTime={x.createdAt}>
                      {new Intl.DateTimeFormat('uk-UA', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Europe/Kyiv',
                      }).format(new Date(x.createdAt))}
                    </time>
                  </li>
                ))}
              </ul>
            )}
            <nav className="account-links" aria-label={t('pagination')}>
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('previous')}
              </Button>
              <span>
                {page} / {query.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= query.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          </>
        )
      )}
      <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
        {t('refresh')}
      </Button>
    </section>
  );
}
