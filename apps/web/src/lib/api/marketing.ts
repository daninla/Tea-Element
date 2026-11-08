import { request } from './orders';
export const marketingApi = {
  unsubscribe: (token: string) =>
    request<{ unsubscribed: true }>('/marketing/unsubscribe', 'POST', { token }),
};
