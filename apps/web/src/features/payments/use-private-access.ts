'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { rememberAccess, restoreAccess } from './private-access';
export function usePrivateAccess(number: string) {
  const params = useSearchParams();
  const fromUrl = params.get('token');
  const urlToken = fromUrl && /^[A-Za-z0-9_-]{43}$/.test(fromUrl) ? fromUrl : undefined;
  const [restored, setRestored] = useState<{ number: string; token?: string } | null>(null);
  useEffect(() => {
    let token = urlToken;
    try {
      if (token) rememberAccess(sessionStorage, number, token);
      else token = restoreAccess(sessionStorage, number);
    } catch {
      /* Browser storage may be unavailable; a URL bearer still works. */
    }
    setRestored({ number, token });
  }, [number, urlToken]);
  return {
    token: urlToken ?? (restored?.number === number ? restored.token : undefined),
    ready: !!urlToken || restored?.number === number,
  };
}
