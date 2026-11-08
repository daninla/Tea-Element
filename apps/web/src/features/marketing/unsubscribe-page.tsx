'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { marketingApi } from '@/lib/api/marketing';
import { Button } from '@/components/ui/button';
export function UnsubscribePage() {
  const t = useTranslations('marketing'),
    started = useRef(false),
    token = useRef('');
  const [state, setState] = useState<'loading' | 'done' | 'error' | 'invalid'>('loading');
  async function send() {
    setState('loading');
    try {
      await marketingApi.unsubscribe(token.current);
      setState('done');
    } catch {
      setState('error');
    }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    token.current = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    window.history.replaceState(null, '', window.location.pathname);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/.test(token.current)) {
      setState('invalid');
      return;
    }
    void send();
  }, []);
  return (
    <section className="container account-page">
      <h1>{t('unsubscribeTitle')}</h1>
      <p role={state === 'error' || state === 'invalid' ? 'alert' : 'status'}>{t(state)}</p>
      {state === 'error' && <Button onClick={() => void send()}>{t('retry')}</Button>}
    </section>
  );
}
