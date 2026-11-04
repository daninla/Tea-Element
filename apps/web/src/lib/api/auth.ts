import type {
  RegisterInput,
  LoginInput,
  PublicUser,
  ProfileInput,
  OrderPageView,
} from '@tea/contracts';
import { request } from './orders';
import { withSessionLock } from './session-lock';
export const authApi = {
  login: (input: LoginInput) =>
    withSessionLock(() => request<PublicUser>('/auth/login', 'POST', input)),
  register: (input: RegisterInput) =>
    withSessionLock(() => request<PublicUser>('/auth/register', 'POST', input)),
  fromOrder: (input: {
    number: string;
    token: string;
    password: string;
    marketingConsent: boolean;
  }) => withSessionLock(() => request<PublicUser>('/auth/register-from-order', 'POST', input)),
  logout: () => withSessionLock(() => request('/auth/logout', 'POST', {})),
  requestEmail: () => request<{ accepted: true }>('/auth/email/request', 'POST', {}),
  confirmEmail: (token: string) => request('/auth/email/confirm', 'POST', { token }),
  requestPassword: (email: string) =>
    request<{ accepted: true }>('/auth/password/request', 'POST', { email }),
  resetPassword: (token: string, password: string) =>
    withSessionLock(() => request('/auth/password/reset', 'POST', { token, password })),
  profile: (profile: ProfileInput) => request<PublicUser>('/auth/profile', 'PATCH', profile),
  orders: (page: number) => request<OrderPageView>(`/orders?page=${page}`),
  lookup: (number: string, email: string) =>
    request<{ accepted: true }>('/orders/lookup', 'POST', { number, email }),
};
