export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}
export const AUTH_RPC_QUEUE = 'auth.rpc';
export const AUTH_PATTERNS = {
  register: 'auth.register',
  login: 'auth.login',
  refresh: 'auth.refresh',
  logout: 'auth.logout',
  me: 'auth.me',
  profile: 'auth.profile',
  requestEmail: 'auth.request_email',
  confirmEmail: 'auth.confirm_email',
  requestPassword: 'auth.request_password',
  resetPassword: 'auth.reset_password',
  registerFromOrder: 'auth.register_from_order',
} as const;
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  emailVerified: boolean;
  defaultDelivery?: import('./orders').DeliveryInput | null;
}
export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  marketingConsent?: boolean;
}
export interface LoginInput {
  email: string;
  password: string;
}
export interface AuthContext {
  correlationId: string;
  userAgent?: string;
  ip?: string;
}
export interface AuthRequest<T> {
  input: T;
  context: AuthContext;
}
export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
export interface AccessClaims {
  sub: string;
  email: string;
  role: Role;
}
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_UNAVAILABLE'
  | 'INVALID_SESSION'
  | 'USER_UNAVAILABLE'
  | 'INVALID_INPUT'
  | 'AUTH_UNAVAILABLE';
export type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: AuthErrorCode; message: string; statusCode: number } };
export interface DomainEvent<TName extends string, TPayload> {
  eventId: string;
  name: TName;
  version: 1;
  occurredAt: string;
  correlationId: string;
  payload: TPayload;
}
export type UserRegistered = DomainEvent<
  'UserRegistered',
  { userId: string; email: string; firstName: string; lastName: string; marketingConsent: boolean }
>;
export const USER_REGISTERED_ROUTING_KEY = 'auth.user_registered';
export const EVENTS_EXCHANGE = 'tea.events';
export const EVENTS_DLX = 'tea.events.dlx';
export const MARKETING_REGISTRATION_QUEUE = 'marketing.user_registered';

export type UserEmailVerified = DomainEvent<'UserEmailVerified', { userId: string; email: string }>;
export type AuthEvent = UserRegistered | UserEmailVerified;
export interface ProfileInput {
  firstName: string;
  lastName: string;
  phone: string | null;
  defaultDelivery: import('./orders').DeliveryInput | null;
}
