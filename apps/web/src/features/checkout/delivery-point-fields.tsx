'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { DeliveryCarrier, DeliveryCity, DeliverySelection } from '@tea/contracts';
import { checkoutDeliveryApi } from '@/lib/api/checkout-delivery';
import { Button } from '@/components/ui/button';

export function DeliveryPointFields({
  carriers,
  change,
}: {
  carriers: DeliveryCarrier[];
  change: (value: DeliverySelection | undefined) => void;
}) {
  const t = useTranslations('checkoutDelivery');
  const [carrier, setCarrier] = useState<DeliveryCarrier>(carriers[0]!);
  const [region, setRegion] = useState('');
  const regions = useQuery({
    queryKey: ['delivery-regions'],
    queryFn: checkoutDeliveryApi.regions,
    enabled: carrier === 'UKRPOSHTA',
    retry: false,
  });
  const [search, setSearch] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [city, setCity] = useState<DeliveryCity>();
  const [number, setNumber] = useState('');
  const [pointQuery, setPointQuery] = useState('');
  const [kind, setKind] = useState('');
  const [pointId, setPointId] = useState('');
  const cities = useQuery({
    queryKey: ['delivery-cities', carrier, cityQuery, region],
    queryFn: () => checkoutDeliveryApi.cities(carrier, cityQuery, region || undefined),
    enabled: cityQuery.length >= 2 && (carrier !== 'UKRPOSHTA' || !!region),
    retry: false,
  });
  const points = useQuery({
    queryKey: ['delivery-points', carrier, city?.id, pointQuery],
    queryFn: () => checkoutDeliveryApi.points(carrier, city!.id, pointQuery),
    enabled: !!city,
    retry: false,
  });
  const listed = points.data?.filter((p) => !kind || p.kind === kind);
  function resetPoint() {
    setPointId('');
    change(undefined);
  }
  function resetCity() {
    setCity(undefined);
    setNumber('');
    setPointQuery('');
    resetPoint();
  }
  return (
    <div className="form-grid">
      <label className="commerce-field">
        {t('carrier')}
        <select
          value={carrier}
          onChange={(e) => {
            setCarrier(e.target.value as DeliveryCarrier);
            setRegion('');
            setSearch('');
            setCityQuery('');
            resetCity();
          }}
        >
          {carriers.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
      </label>
      {carrier === 'UKRPOSHTA' && (
        <label className="commerce-field">
          {t('region')}
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setCityQuery('');
              resetCity();
            }}
          >
            <option value="">{t(regions.isFetching ? 'loading' : 'choose')}</option>
            {regions.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {carrier === 'UKRPOSHTA' && regions.isError && <p role="alert">{t('lookupError')}</p>}
      <div>
        <label className="commerce-field">
          {t('citySearch')}
          <input
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              setCityQuery('');
              resetCity();
            }}
          />
        </label>
        <Button
          type="button"
          disabled={
            search.trim().length < 2 || cities.isFetching || (carrier === 'UKRPOSHTA' && !region)
          }
          onClick={() => {
            setCityQuery(search.trim());
            if (cityQuery === search.trim()) void cities.refetch();
          }}
        >
          {t('findCity')}
        </Button>
      </div>
      {cities.isFetching && <p role="status">{t('loading')}</p>}
      {cities.isError && <p role="alert">{t('lookupError')}</p>}
      {cities.data && (
        <label className="commerce-field">
          {t('city')}
          <select
            value={city?.id ?? ''}
            onChange={(e) => {
              resetCity();
              setCity(cities.data.find((x) => x.id === e.target.value));
            }}
          >
            <option value="">{t(cities.data.length ? 'choose' : 'empty')}</option>
            {cities.data.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {city && (
        <>
          <label className="commerce-field">
            {t('pointType')}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                resetPoint();
              }}
            >
              <option value="">{t('all')}</option>
              <option value="BRANCH">{t('BRANCH')}</option>
              <option value="LOCKER">{t('LOCKER')}</option>
            </select>
          </label>
          <div>
            <label className="commerce-field">
              {t('pointSearch')}
              <input
                value={number}
                maxLength={100}
                onChange={(e) => {
                  setNumber(e.target.value);
                  resetPoint();
                }}
              />
            </label>
            <Button
              type="button"
              disabled={points.isFetching}
              onClick={() => {
                setPointQuery(number.trim());
                resetPoint();
                if (pointQuery === number.trim()) void points.refetch();
              }}
            >
              {t('findPoint')}
            </Button>
          </div>
          {points.isFetching && <p role="status">{t('loading')}</p>}
          {points.isError && <p role="alert">{t('lookupError')}</p>}
          {listed && !points.isFetching && (
            <label className="commerce-field">
              {t('point')}
              <select
                value={pointId}
                onChange={(e) => {
                  const value = e.target.value;
                  setPointId(value);
                  change(value ? { carrier, cityId: city.id, pointId: value } : undefined);
                }}
              >
                <option value="">{t(listed.length ? 'choose' : 'empty')}</option>
                {listed.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.kind)} {p.number} · {p.address}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </div>
  );
}
