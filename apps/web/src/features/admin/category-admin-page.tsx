'use client';
import { AdminTableScroll } from './admin-table';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { AdminCategory } from '@tea/contracts';
import { catalogAdminApi } from '@/lib/api/catalog-admin';
import { Button } from '@/components/ui/button';
import { categoryFields } from './catalog-schema';
import { useCatalogSave } from './use-catalog-save';
import { CatalogAudit } from './catalog-audit';
export function CategoryAdminPage() {
  const t = useTranslations('catalogAdmin'),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<AdminCategory>(),
    [generation, setGeneration] = useState(0);
  const list = useQuery({
    queryKey: ['admin-categories', page],
    queryFn: () => catalogAdminApi.categories('page=' + page),
    retry: false,
  });
  return (
    <>
      <h1>{t('categories')}</h1>
      <p>{t('categoryIntro')}</p>
      <Button
        variant="outline"
        onClick={() => {
          setSelected(undefined);
          setGeneration((x) => x + 1);
        }}
      >
        {t('newCategory')}
      </Button>
      {list.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : list.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        list.data && (
          <>
            <AdminTableScroll label={t('categories')}>
              <table className="admin-table">
                <caption>{t('categories')}</caption>
                <thead>
                  <tr>
                    {['name', 'section', 'visibility', 'edit'].map((x) => (
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
                      <td>{t(x.section)}</td>
                      <td>{t(x.isActive ? 'active' : 'hidden')}</td>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelected(x);
                            setGeneration((n) => n + 1);
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
      <Button variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
        {t('refresh')}
      </Button>
      <CategoryForm
        key={generation}
        current={selected}
        saved={(x) => {
          setSelected(x);
          setGeneration((n) => n + 1);
        }}
      />
      {selected && <CatalogAudit key={selected.id + ':' + selected.revision} id={selected.id} />}
    </>
  );
}
function CategoryForm({
  current,
  saved,
}: {
  current?: AdminCategory;
  saved: (x: AdminCategory) => void;
}) {
  const t = useTranslations('catalogAdmin'),
    client = useQueryClient(),
    command = useCatalogSave('category:' + (current?.id ?? 'new'));
  const [invalid, setInvalid] = useState(false);
  const form = useForm({
    defaultValues: {
      slug: current?.slug ?? '',
      name: current?.name ?? '',
      description: current?.description ?? '',
      section: current?.section ?? 'TEA',
      sortOrder: current?.sortOrder ?? 0,
      isActive: current?.isActive ?? true,
    },
  });
  return (
    <form
      className="commerce-card catalog-editor"
      onSubmit={form.handleSubmit(async (raw) => {
        const parsed = categoryFields.safeParse(raw);
        setInvalid(!parsed.success);
        if (!parsed.success) return;
        const x = await command.save({ input: parsed.data, revision: current?.revision }, (key) =>
          catalogAdminApi.saveCategory(parsed.data, key, current),
        );
        if (x) {
          await client.invalidateQueries({ queryKey: ['admin-categories'] });
          saved(x);
        }
      })}
    >
      <h2>{t(current ? 'editCategory' : 'newCategory')}</h2>
      <fieldset disabled={command.busy}>
        {(['name', 'slug', 'description'] as const).map((x) => (
          <label key={x} className="commerce-field">
            {t(x)}
            {x === 'description' ? (
              <textarea {...form.register(x)} maxLength={5000} />
            ) : (
              <input
                {...form.register(x)}
                readOnly={x === 'slug' && !!current}
                maxLength={x === 'name' ? 150 : 100}
                required
              />
            )}
          </label>
        ))}
        <label className="commerce-field">
          {t('section')}
          <select {...form.register('section')} disabled={!!current}>
            <option value="TEA">{t('TEA')}</option>
            <option value="EQUIPMENT">{t('EQUIPMENT')}</option>
          </select>
        </label>
        <label className="commerce-field">
          {t('sortOrder')}
          <input type="number" min={0} max={100000} {...form.register('sortOrder')} />
        </label>
        <label className="account-check">
          <input type="checkbox" {...form.register('isActive')} />
          {t('active')}
        </label>
        <p>{t('immutableHint')}</p>
        {invalid && <p role="alert">{t('invalid')}</p>}
        {command.message && (
          <p role={command.message === 'saved' ? 'status' : 'alert'}>{t(command.message)}</p>
        )}
        <Button type="submit">{t(command.busy ? 'saving' : 'save')}</Button>
      </fieldset>
      {command.uncertain && (
        <label className="account-check">
          <input
            type="checkbox"
            onChange={(e) => {
              if (e.target.checked) {
                command.reviewed();
                form.reset();
              }
            }}
          />
          {t('reviewed')}
        </label>
      )}
    </form>
  );
}
