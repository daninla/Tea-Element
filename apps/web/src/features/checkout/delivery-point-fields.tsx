'use client';
import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { DeliveryCarrier, DeliverySelection } from '@tea/contracts';
import { checkoutDeliveryApi } from '@/lib/api/checkout-delivery';
import { DeliverySuggestions } from './delivery-suggestions';

function useSearchText(value: string) {
  const [query, setQuery] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value.trim()), 650);
    return () => clearTimeout(timer);
  }, [value]);
  return query;
}

export function DeliveryPointFields({
  carrier,
  available,
  change,
}: {
  carrier: DeliveryCarrier;
  available: boolean;
  change: (value: DeliverySelection | undefined) => void;
}) {
  const t = useTranslations('checkoutDelivery');
  const [region, setRegion] = useState('');
  const [cityText, setCityText] = useState('');
  const [cityId, setCityId] = useState('');
  const [pointText, setPointText] = useState('');
  const [pointId, setPointId] = useState('');
  const cityQuery = useSearchText(cityText);
  const pointQuery = useSearchText(pointText);
  const regions = useQuery({
    queryKey: ['delivery-regions'],
    queryFn: checkoutDeliveryApi.regions,
    enabled: available && carrier === 'UKRPOSHTA',
    retry: false,
  });
  const cities = useQuery({
    queryKey: ['delivery-cities', carrier, cityQuery, region],
    queryFn: () => checkoutDeliveryApi.cities(carrier, cityQuery, region || undefined),
    enabled: available && !cityId && cityQuery.length >= 2 && (carrier !== 'UKRPOSHTA' || !!region),
    retry: false,
  });
  const points = useInfiniteQuery({
    queryKey: ['delivery-points', carrier, cityId, pointQuery],
    queryFn: ({ pageParam }) => checkoutDeliveryApi.points(carrier, cityId, pointQuery, pageParam),
    enabled: available && !!cityId && !pointId && pointQuery === pointText.trim(),
    initialPageParam: 1,
    getNextPageParam: (last, _all, page) =>
      last.length === 100 && page < 100 ? page + 1 : undefined,
    retry: 1,
    retryDelay: 1200,
    staleTime: 30_000,
  });
  const cityReady = cityQuery === cityText.trim() && cityQuery.length >= 2;
  const pointReady = !!cityId && pointQuery === pointText.trim();
  const cityOptions = cityReady
    ? (cities.data?.map((city) => ({ id: city.id, label: city.name })) ?? [])
    : [];
  const pointOptions = pointReady
    ? [
        ...new Map(
          points.data?.pages.flat().map((point) => [
            point.id,
            {
              id: point.id,
              label: carrier === 'UKRPOSHTA' ? point.number + ' · ' + point.address : point.address,
            },
          ]),
        ).values(),
      ]
    : [];
  function clearCity() {
    setCityId('');
    setPointId('');
    change(undefined);
  }
  return (
    <div className="delivery-fields">
      {carrier === 'UKRPOSHTA' && (
        <label className="commerce-field">
          {t('region')}
          <select
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
              clearCity();
            }}
          >
            <option value="">{t(regions.isFetching ? 'loading' : 'choose')}</option>
            {regions.data?.map((r) => (
              <option value={r.id} key={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <DeliverySuggestions
        label={t('city')}
        value={cityText}
        selected={!!cityId}
        options={cityOptions}
        change={(value) => {
          setCityText(value);
          clearCity();
        }}
        select={(option) => {
          setCityId(option.id);
          setCityText(option.label);
        }}
        status={
          cityReady
            ? cities.isFetching
              ? t('loading')
              : cities.isError
                ? t('lookupError')
                : cities.data && !cityOptions.length
                  ? t('empty')
                  : undefined
            : undefined
        }
      />
      <DeliverySuggestions
        label={t('pointSearch')}
        value={pointText}
        selected={!!pointId}
        options={pointOptions}
        change={(value) => {
          setPointText(value);
          setPointId('');
          change(undefined);
        }}
        select={(option) => {
          setPointText(option.label);
          setPointId(option.id);
          change({ carrier, cityId, pointId: option.id });
        }}
        status={
          !cityId
            ? t('chooseCityFirst')
            : pointReady
              ? points.isFetching && !pointOptions.length
                ? t('loading')
                : points.isError
                  ? t('lookupError')
                  : points.data && !pointOptions.length
                    ? t('empty')
                    : undefined
              : undefined
        }
        more={
          pointReady && points.hasNextPage
            ? {
                label: t('morePoints'),
                disabled: points.isFetching,
                load: () => void points.fetchNextPage(),
              }
            : undefined
        }
      />
    </div>
  );
}
