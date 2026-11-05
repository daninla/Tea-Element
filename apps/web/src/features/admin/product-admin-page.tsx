'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { BUNDLED_CATALOG_IMAGES, type AdminProduct, type AdminProductInput } from '@tea/contracts';
import { catalogAdminApi } from '@/lib/api/catalog-admin';
import { Button } from '@/components/ui/button';
import { productFields } from './catalog-schema';
import { useCatalogSave } from './use-catalog-save';
import { CatalogAudit } from './catalog-audit';
export function ProductAdminPage({ id }: { id?: string }) {
  const t = useTranslations('catalogAdmin');
  const item = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => catalogAdminApi.product(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return (
    <>
      <Link className="text-link" href="/admin/products">
        {t('back')}
      </Link>
      <h1>{t(id ? 'editProduct' : 'newProduct')}</h1>
      {id && item.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : id && item.isError ? (
        <>
          <p role="alert">{t('error')}</p>
          <Button onClick={() => void item.refetch()}>{t('refresh')}</Button>
        </>
      ) : (
        <ProductForm key={item.data?.revision ?? 'new'} current={item.data} />
      )}
    </>
  );
}
function ProductForm({ current }: { current?: AdminProduct }) {
  const t = useTranslations('catalogAdmin'),
    router = useRouter(),
    client = useQueryClient(),
    command = useCatalogSave('product:' + (current?.id ?? 'new'));
  const [invalid, setInvalid] = useState(false),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState(false);
  const categories = useInfiniteQuery({
    queryKey: ['admin-category-options'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => catalogAdminApi.categories(`page=${pageParam}&pageSize=100`),
    getNextPageParam: (x) => (x.page < x.totalPages ? x.page + 1 : undefined),
    retry: false,
  });
  const choices = [
    ...new Map(
      [
        ...(current ? [current.category] : []),
        ...(categories.data?.pages.flatMap((x) => x.items) ?? []),
      ].map((x) => [x.id, x]),
    ).values(),
  ];
  const form = useForm({
    defaultValues: {
      slug: current?.slug ?? '',
      name: current?.name ?? '',
      nameOriginal: current?.nameOriginal ?? '',
      description: current?.description ?? '',
      origin: current?.origin ?? '',
      year: current?.year ? String(current.year) : '',
      categoryId: current?.categoryId ?? '',
      isActive: current?.isActive ?? false,
      tags: current?.tags.join(', ') ?? '',
      images: current?.images ?? [],
      brewingEnabled: !!current?.brewingGuide,
      temperature: String(current?.brewingGuide?.temperatureCelsius ?? 90),
      seconds: String(current?.brewingGuide?.seconds ?? 30),
      infusions: String(current?.brewingGuide?.infusions ?? 5),
      variants: current?.variants.map((x) => ({
        ...x,
        weight: x.weightGrams === null ? '' : String(x.weightGrams),
        price: `${Math.floor(x.price / 100)}.${String(x.price % 100).padStart(2, '0')}`,
      })) ?? [
        { id: undefined as string | undefined, sku: '', weight: '25', price: '', isActive: true },
      ],
    },
  });
  const variants = useFieldArray({ control: form.control, name: 'variants', keyName: 'fieldKey' });
  const categoryId = form.watch('categoryId'),
    section = choices.find((x) => x.id === categoryId)?.section,
    images = form.watch('images');
  const selected = form.register('categoryId');
  return (
    <>
      <form
        className="commerce-card catalog-editor"
        onSubmit={form.handleSubmit(async (raw) => {
          const parsed = productFields.safeParse(raw);
          setInvalid(!parsed.success);
          if (!parsed.success) return;
          const {
            variants: values,
            brewingEnabled,
            temperature,
            seconds,
            infusions,
            ...rest
          } = parsed.data;
          const input: AdminProductInput = {
            ...rest,
            brewingGuide:
              brewingEnabled && section === 'TEA'
                ? {
                    temperatureCelsius: Number(temperature),
                    seconds: Number(seconds),
                    infusions: Number(infusions),
                  }
                : null,
            variants: values.map(({ weight, ...v }) => ({ ...v, weightGrams: weight })),
          };
          const x = await command.save({ input, revision: current?.revision }, (key) =>
            catalogAdminApi.saveProduct(input, key, current),
          );
          if (x) {
            client.setQueryData(['admin-product', x.id], x);
            await Promise.all([
              client.invalidateQueries({ queryKey: ['admin-products'] }),
              client.invalidateQueries({ queryKey: ['catalog-audit', x.id] }),
            ]);
            if (!current) router.replace('/admin/products/' + x.id);
          }
        })}
      >
        <p>{t('editorHint')}</p>
        <fieldset disabled={command.busy || uploading}>
          {(['name', 'slug', 'nameOriginal', 'description', 'origin', 'year', 'tags'] as const).map(
            (x) => (
              <label key={x} className="commerce-field">
                {t(x)}
                {x === 'description' ? (
                  <textarea {...form.register(x)} rows={5} maxLength={20000} required />
                ) : (
                  <input
                    {...form.register(x)}
                    readOnly={x === 'slug' && !!current}
                    maxLength={
                      x === 'slug' ? 160 : x === 'origin' ? 150 : x === 'tags' ? 1020 : 200
                    }
                    required={x === 'name' || x === 'slug'}
                    inputMode={x === 'year' ? 'numeric' : undefined}
                  />
                )}
              </label>
            ),
          )}
          <label className="commerce-field">
            {t('category')}
            <select
              {...selected}
              onChange={(e) => {
                const next = choices.find((x) => x.id === e.target.value);
                void selected.onChange(e);
                if (!current && next?.section !== section) {
                  variants.replace([
                    {
                      id: undefined,
                      sku: '',
                      weight: next?.section === 'EQUIPMENT' ? '' : '25',
                      price: '',
                      isActive: true,
                    },
                  ]);
                  form.setValue('brewingEnabled', false);
                }
              }}
              required
            >
              <option value="">{t('chooseCategory')}</option>
              {choices
                .filter((x) => !current || x.section === current.category.section)
                .map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.name}
                    {!x.isActive ? ' · ' + t('hidden') : ''}
                  </option>
                ))}
            </select>
          </label>
          {categories.isPending && <p role="status">{t('loading')}</p>}
          {categories.isError && <p role="alert">{t('error')}</p>}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void (categories.hasNextPage ? categories.fetchNextPage() : categories.refetch())
            }
            disabled={categories.isFetching}
          >
            {t(categories.hasNextPage ? 'loadMore' : 'refreshCategories')}
          </Button>
          <label className="account-check">
            <input type="checkbox" {...form.register('isActive')} />
            {t('active')}
          </label>
          <h2>{t('variants')}</h2>
          <p>{t('variantHint')}</p>
          {variants.fields.map((row, i) => (
            <fieldset className="catalog-variant" key={row.fieldKey}>
              <legend>
                {t(section === 'EQUIPMENT' ? 'pieceVariant' : 'portion', { n: i + 1 })}
              </legend>
              <label className="commerce-field">
                {t('sku')}
                <input
                  {...form.register(`variants.${i}.sku`)}
                  readOnly={!!row.id}
                  maxLength={100}
                  required
                />
              </label>
              {section !== 'EQUIPMENT' && (
                <label className="commerce-field">
                  {t('weight')}
                  <input
                    {...form.register(`variants.${i}.weight`)}
                    readOnly={!!row.id}
                    inputMode="numeric"
                    required
                  />
                </label>
              )}
              <label className="commerce-field">
                {t('price')}
                <input {...form.register(`variants.${i}.price`)} inputMode="decimal" required />
              </label>
              <label className="account-check">
                <input type="checkbox" {...form.register(`variants.${i}.isActive`)} />
                {t('variantActive')}
              </label>
              {!row.id && variants.fields.length > 1 && (
                <Button variant="outline" type="button" onClick={() => variants.remove(i)}>
                  {t('remove')}
                </Button>
              )}
            </fieldset>
          ))}
          {section === 'TEA' && (
            <Button
              type="button"
              variant="outline"
              disabled={variants.fields.length >= 20}
              onClick={() =>
                variants.append({ id: undefined, sku: '', weight: '', price: '', isActive: true })
              }
            >
              {t('addVariant')}
            </Button>
          )}
          {section === 'TEA' && (
            <>
              <label className="account-check">
                <input type="checkbox" {...form.register('brewingEnabled')} />
                {t('brewing')}
              </label>
              {form.watch('brewingEnabled') &&
                (['temperature', 'seconds', 'infusions'] as const).map((x) => (
                  <label className="commerce-field" key={x}>
                    {t(x)}
                    <input {...form.register(x)} inputMode="numeric" required />
                  </label>
                ))}
            </>
          )}
          <h2>{t('images')}</h2>
          <p>{t('imageHint')}</p>
          <div className="catalog-image-list">
            {images.map((path, i) => (
              <div className="catalog-image-item" key={path}>
                <Image
                  src={path}
                  alt={form.getValues('name') || t('imageAlt')}
                  width={160}
                  height={130}
                />
                <span>{t(i === 0 ? 'cover' : 'photo', { n: i + 1 })}</span>
                <div className="account-links">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...images];
                      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                      form.setValue('images', next);
                    }}
                  >
                    {t('moveFirst')}
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() =>
                      form.setValue(
                        'images',
                        images.filter((x) => x !== path),
                      )
                    }
                  >
                    {t('remove')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!images.length && <p>{t('defaultImage')}</p>}
          <label className="commerce-field">
            {t('bundledImage')}
            <select
              value=""
              disabled={images.length >= 10}
              onChange={(e) => {
                if (e.target.value && !images.includes(e.target.value))
                  form.setValue('images', [...images, e.target.value]);
              }}
            >
              <option value="">{t('chooseImage')}</option>
              {BUNDLED_CATALOG_IMAGES.map((x, i) => (
                <option value={x} disabled={images.includes(x)} key={x}>
                  {t('bundled' + i)}
                </option>
              ))}
            </select>
          </label>
          <label className="commerce-field">
            {t('upload')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={images.length >= 10}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploadError(false);
                if (file.size > 5242880) {
                  setUploadError(true);
                  return;
                }
                setUploading(true);
                try {
                  const asset = await catalogAdminApi.upload(file);
                  form.setValue('images', [...form.getValues('images'), asset.path]);
                } catch {
                  setUploadError(true);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </fieldset>
        {uploading && <p role="status">{t('uploading')}</p>}
        {uploadError && <p role="alert">{t('uploadError')}</p>}
        {invalid && <p role="alert">{t('invalid')}</p>}
        {command.message && (
          <p role={command.message === 'saved' ? 'status' : 'alert'}>{t(command.message)}</p>
        )}
        <Button type="submit" disabled={command.busy || uploading}>
          {t(command.busy ? 'saving' : 'save')}
        </Button>
        {command.uncertain && (
          <>
            <Link className="text-link" href="/admin/products" target="_blank" rel="noopener">
              {t('reviewList')}
            </Link>
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
          </>
        )}
      </form>
      {current && (
        <>
          <div className="account-links">
            <Link href={'/admin/inventory/' + current.id}>{t('inventory')}</Link>
            {current.isActive && (
              <Link href={'/product/' + current.slug} target="_blank" rel="noopener">
                {t('preview')}
              </Link>
            )}
          </div>
          <CatalogAudit key={current.revision} id={current.id} />
        </>
      )}
    </>
  );
}
