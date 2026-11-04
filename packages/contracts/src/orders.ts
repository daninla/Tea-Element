import type { PaymentRequested, PaymentOutcome, PaymentAttemptAbandoned } from './payments';
import type { DomainEvent } from './auth';
export const ORDERS_PATTERNS = {
  quote: 'orders.quote',
  create: 'orders.create',
  get: 'orders.get',
  cancel: 'orders.cancel',
  cart: 'orders.cart',
  saveCart: 'orders.save_cart',
  mergeCart: 'orders.merge_cart',
  changePayment: 'orders.change_payment',
} as const;
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PAID',
  'REJECTED',
  'CANCELLED',
  'SHIPPED',
  'COMPLETED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export interface CartItemInput {
  variantId: string;
  quantity: number;
}
export interface QuotedItem extends CartItemInput {
  productId: string;
  slug: string;
  name: string;
  weightGrams: number | null;
  unitPrice: number;
  originalPrice: number;
  inStock: boolean;
}
export interface CartQuote {
  items: QuotedItem[];
  unavailableVariantIds: string[];
  subtotal: number;
  discount: number;
  total: number;
}
export interface DeliveryInput {
  method: 'NOVA_POSHTA_BRANCH' | 'NOVA_POSHTA_COURIER' | 'PICKUP';
  city: string;
  address: string;
}
export interface CreateOrderInput {
  items: CartItemInput[];
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  delivery: DeliveryInput;
  paymentMethod: 'CASH_ON_DELIVERY' | 'ONLINE_CARD';
  comment?: string;
  marketingConsent: boolean;
  acceptTerms: true;
}
export interface OrderView {
  id: string;
  number: string;
  status: OrderStatus;
  items: QuotedItem[];
  subtotal: number;
  discount: number;
  total: number;
  delivery: DeliveryInput;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  paymentMethod: 'CASH_ON_DELIVERY' | 'ONLINE_CARD';
  paymentAttemptId?: string | null;
  paymentStatus?: string;
  paymentExpiresAt?: string | null;
  createdAt: string;
  history: { status: OrderStatus; at: string }[];
}
export interface CreatedOrder {
  order: OrderView;
  accessToken: string;
}
export interface OrdersRequest<T = unknown> {
  input: T;
  context: { correlationId: string; userId?: string };
}
export type OrdersResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; statusCode: number } };
export interface StockLine {
  productId: string;
  variantId: string;
  weightGrams: number;
  quantity: number;
}
export type OrderCreated = DomainEvent<'OrderCreated', { orderId: string; items: StockLine[] }>;
export interface StockLineV2 {
  productId: string;
  variantId: string;
  stockUnit: 'GRAM' | 'PIECE';
  stockQuantity: number;
  quantity: number;
}
export type OrderCreatedV2 = Omit<
  DomainEvent<'OrderCreated', { orderId: string; items: StockLineV2[] }>,
  'version'
> & { version: 2 };
export function checkoutRoutingKey(event: CheckoutEvent) {
  return event.name === 'OrderCreated' && event.version === 2
    ? CHECKOUT_ROUTES.OrderCreatedV2
    : CHECKOUT_ROUTES[event.name];
}
export type OrderCancelled = DomainEvent<
  'OrderCancelled',
  { orderId: string; reason: 'CUSTOMER' | 'RESERVATION_TIMEOUT' }
>;
export type StockReserved = DomainEvent<'StockReserved', { orderId: string }>;
export type StockReservationFailed = DomainEvent<'StockReservationFailed', { orderId: string }>;
export type OrderPaid = DomainEvent<'OrderPaid', { orderId: string }>;
export type OrderConfirmed = DomainEvent<'OrderConfirmed', { orderId: string }>;
export type CheckoutEvent =
  | OrderCreated
  | OrderCreatedV2
  | OrderCancelled
  | StockReserved
  | StockReservationFailed
  | OrderConfirmed
  | OrderPaid
  | PaymentRequested
  | PaymentAttemptAbandoned
  | PaymentOutcome;
export const CHECKOUT_ROUTES = {
  OrderCreated: 'orders.order_created',
  OrderCreatedV2: 'orders.order_created.v2',
  OrderCancelled: 'orders.order_cancelled',
  StockReserved: 'catalog.stock_reserved',
  StockReservationFailed: 'catalog.stock_reservation_failed',
  OrderConfirmed: 'orders.order_confirmed',
  OrderPaid: 'orders.order_paid',
  PaymentRequested: 'orders.payment_requested',
  PaymentAttemptAbandoned: 'orders.payment_attempt_abandoned',
  PaymentSucceeded: 'payments.payment_succeeded',
  PaymentFailed: 'payments.payment_failed',
  PaymentExpired: 'payments.payment_expired',
  PaymentRefunded: 'payments.payment_refunded',
} as const;
export const CHECKOUT_SUBSCRIPTIONS = [
  ['catalog.order_created', 'OrderCreated'],
  ['catalog.order_created_v2', 'OrderCreatedV2'],
  ['catalog.order_cancelled', 'OrderCancelled'],
  ['payments.payment_requested', 'PaymentRequested'],
  ['payments.payment_attempt_abandoned', 'PaymentAttemptAbandoned'],
  ['payments.order_cancelled', 'OrderCancelled'],
  ['orders.payment_succeeded', 'PaymentSucceeded'],
  ['orders.payment_failed', 'PaymentFailed'],
  ['orders.payment_expired', 'PaymentExpired'],
  ['orders.payment_refunded', 'PaymentRefunded'],
  ['orders.stock_reserved', 'StockReserved'],
  ['orders.stock_reservation_failed', 'StockReservationFailed'],
] as const;
