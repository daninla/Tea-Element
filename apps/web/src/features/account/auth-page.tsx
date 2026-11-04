'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api/auth';
import { ordersApi } from '@/lib/api/orders';
import { Button } from '@/components/ui/button';
import { usePrivateAccess } from '@/features/payments/use-private-access';
import { authFields, signupFields, safeAccountNext } from './account-schema';
import { clearPrivateSession } from './auth-state';
export type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'lookup';
interface Fields {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  marketingConsent: boolean;
  acceptTerms: boolean;
  number: string;
}
export function AuthPage({ mode }: { mode: AuthMode }) {
  const t = useTranslations('account');
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const source = params.get('order');
  const orderNumber = source && /^TE-[A-F0-9]{32}$/.test(source) ? source : undefined;
  const access = usePrivateAccess(orderNumber ?? 'registration');
  const registrationOrder = mode === 'register' && !!orderNumber;
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const gate = useRef(false);
  const navigated = useRef(false);
  const form = useForm<Fields>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      phone: '',
      marketingConsent: false,
      acceptTerms: false,
      number: '',
    },
  });
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const order = useQuery({
    queryKey: ['signup-order', orderNumber, access.token],
    queryFn: () => ordersApi.get(orderNumber!, access.token),
    enabled: registrationOrder && access.ready && !!access.token,
    retry: false,
  });
  useEffect(() => {
    if (mode === 'verify' || mode === 'reset')
      setProof(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  }, [mode]);
  useEffect(() => {
    if (
      (mode === 'login' || mode === 'register') &&
      session.data &&
      !session.isFetching &&
      !navigated.current
    ) {
      navigated.current = true;
      router.replace(safeAccountNext(params.get('next')));
    }
  }, [mode, session.data, session.isFetching, router, params]);
  async function submit(fields: Fields) {
    if (gate.current) return;
    setInvalid(false);
    setError(false);
    const valid =
      mode === 'login'
        ? authFields.safeParse(fields).success
        : mode === 'register'
          ? registrationOrder
            ? fields.password.length >= 8 &&
              fields.password.length <= 128 &&
              fields.password === fields.confirmPassword &&
              fields.acceptTerms
            : signupFields.safeParse(fields).success
          : mode === 'reset'
            ? proof.length > 0 &&
              fields.password.length >= 8 &&
              fields.password.length <= 128 &&
              fields.password === fields.confirmPassword
            : mode === 'verify'
              ? !!proof
              : mode === 'lookup'
                ? /^TE-[A-F0-9]{32}$/.test(fields.number) &&
                  authFields.shape.email.safeParse(fields.email).success
                : authFields.shape.email.safeParse(fields.email).success;
    if (!valid) {
      setInvalid(true);
      return;
    }
    gate.current = true;
    setBusy(true);
    try {
      if (mode === 'login' || mode === 'register') {
        const user =
          mode === 'login'
            ? await authApi.login({ email: fields.email, password: fields.password })
            : registrationOrder
              ? await authApi.fromOrder({
                  number: orderNumber!,
                  token: access.token!,
                  password: fields.password,
                  marketingConsent: fields.marketingConsent,
                })
              : await authApi.register({
                  email: fields.email,
                  password: fields.password,
                  firstName: fields.firstName,
                  lastName: fields.lastName,
                  ...(fields.phone ? { phone: fields.phone } : {}),
                  marketingConsent: fields.marketingConsent,
                });
        await client.cancelQueries();
        client.clear();
        client.setQueryData(['customer-session'], user);
        navigated.current = true;
        router.replace(safeAccountNext(params.get('next')));
      } else if (mode === 'forgot') {
        await authApi.requestPassword(fields.email);
        setDone(true);
      } else if (mode === 'lookup') {
        await authApi.lookup(fields.number, fields.email);
        setDone(true);
      } else if (mode === 'verify') {
        await authApi.confirmEmail(proof);
        await client.invalidateQueries({ queryKey: ['customer-session'] });
        await client.invalidateQueries({ queryKey: ['account-orders'] });
        setDone(true);
      } else {
        await authApi.resetPassword(proof, fields.password);
        await clearPrivateSession(client);
        setDone(true);
      }
    } catch {
      setError(true);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  if ((mode === 'login' || mode === 'register') && session.isPending)
    return (
      <section className="container commerce-page">
        <p role="status">{t('loading')}</p>
      </section>
    );
  return (
    <section className="container commerce-page auth-page">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t(`title.${mode}`)}</h1>
      <p className="commerce-intro">{t('demo')}</p>
      {done ? (
        <div className="notice" role="status">
          <p>
            {t(
              mode === 'forgot' || mode === 'lookup'
                ? 'sent'
                : mode === 'verify'
                  ? 'verified'
                  : 'resetDone',
            )}
          </p>
          <Link href={mode === 'verify' ? '/account' : '/login'} className="text-link">
            {t(mode === 'verify' ? 'cabinet' : 'loginLink')}
          </Link>
        </div>
      ) : registrationOrder && (!access.ready || (order.isPending && !!access.token)) ? (
        <p role="status">{t('loading')}</p>
      ) : registrationOrder && (!access.token || order.isError) ? (
        <p role="alert">{t('orderAccessError')}</p>
      ) : (
        <form className="account-form" noValidate onSubmit={form.handleSubmit(submit)}>
          <fieldset disabled={busy}>
            {registrationOrder && order.data && (
              <p className="notice">{t('fromOrder', { email: order.data.email })}</p>
            )}
            {mode === 'lookup' && (
              <label className="commerce-field">
                {t('number')}
                <input {...form.register('number')} autoComplete="off" maxLength={35} />
              </label>
            )}
            {(mode === 'login' ||
              mode === 'forgot' ||
              mode === 'lookup' ||
              (mode === 'register' && !registrationOrder)) && (
              <label className="commerce-field">
                {t('email')}
                <input
                  {...form.register('email')}
                  type="email"
                  autoComplete="email"
                  maxLength={320}
                />
              </label>
            )}
            {mode === 'register' &&
              !registrationOrder &&
              (['firstName', 'lastName', 'phone'] as const).map((field) => (
                <label key={field} className="commerce-field">
                  {t(field)}
                  <input
                    {...form.register(field)}
                    autoComplete={
                      field === 'phone'
                        ? 'tel'
                        : field === 'firstName'
                          ? 'given-name'
                          : 'family-name'
                    }
                    type={field === 'phone' ? 'tel' : 'text'}
                    maxLength={100}
                  />
                </label>
              ))}
            {['login', 'register', 'reset'].includes(mode) && (
              <label className="commerce-field">
                {t('password')}
                <input
                  {...form.register('password')}
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  maxLength={128}
                />
                <small>{t('passwordHint')}</small>
              </label>
            )}
            {(mode === 'register' || mode === 'reset') && (
              <label className="commerce-field">
                {t('confirmPassword')}
                <input
                  {...form.register('confirmPassword')}
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                />
              </label>
            )}
            {mode === 'verify' && <p>{t('verifyHint')}</p>}
            {mode === 'register' && (
              <div className="consent-fields">
                <label>
                  <input type="checkbox" {...form.register('acceptTerms')} />
                  <span>
                    {t('terms')} <Link href="/terms">{t('termsLink')}</Link>
                  </span>
                </label>
                <label>
                  <input type="checkbox" {...form.register('marketingConsent')} />
                  <span>{t('marketing')}</span>
                </label>
              </div>
            )}
            {invalid && (
              <p className="field-error" role="alert">
                {t('invalid')}
              </p>
            )}
            {error && (
              <p className="field-error" role="alert">
                {t('error')}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {t(busy ? 'working' : `action.${mode}`)}
            </Button>
          </fieldset>
        </form>
      )}
      <div className="account-links">
        <Link href="/login">{t('loginLink')}</Link>
        <Link href="/register">{t('registerLink')}</Link>
        <Link href="/forgot-password">{t('forgotLink')}</Link>
        <Link href="/order-lookup">{t('lookupLink')}</Link>
      </div>
    </section>
  );
}
