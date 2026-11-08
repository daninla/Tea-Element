import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const requireAt = (service) => createRequire(path.join(root, 'apps', service, 'package.json'));
const reqP = requireAt('payments-service'),
  reqO = requireAt('orders-service'),
  reqC = requireAt('catalog-service');
const { PrismaClient: PaymentsClient } = reqP('./generated/prisma');
const { PrismaClient: OrdersClient } = reqO('./generated/prisma');
const { PrismaClient: CatalogClient } = reqC('./generated/prisma');
const { PrismaPaymentStore } = reqP('./dist/modules/payments/infrastructure/prisma-payment-store');
const { FakePaymentProvider } = reqP(
  './dist/modules/payments/infrastructure/fake-payment-provider',
);
const { MaintainPayments } = reqP('./dist/modules/payments/application/maintain-payments');
const { CHECKOUT_SUBSCRIPTIONS } = reqP('@tea/contracts');
const amqp = reqP('amqplib');
const tag = randomUUID().replaceAll('-', ''),
  namespace = `stage4a-${tag}`;
const secret = randomBytes(48).toString('hex');
const names = Object.fromEntries(
  ['payments', 'orders', 'catalog'].map((s) => [s, `${s}_stage4a_${tag}`]),
);
const urls = Object.fromEntries(
  Object.entries(names).map(([s, n]) => [s, `postgresql://${s}:tea_dev_${s}@localhost:5433/${n}`]),
);
const env = {
  ...process.env,
  NODE_ENV: 'development',
  LOG_LEVEL: 'silent',
  PAYMENT_PROVIDER: 'fake',
  FAKE_PAYMENT_SECRET: secret,
  JWT_ACCESS_SECRET: secret,
  ORDER_ACCESS_SECRET: secret,
  EVENTS_NAMESPACE: namespace,
  PAYMENTS_RPC_QUEUE: `${namespace}.payments.rpc`,
  ORDERS_RPC_QUEUE: `${namespace}.orders.rpc`,
  CATALOG_RPC_QUEUE: `${namespace}.catalog.rpc`,
  RABBITMQ_URL: 'amqp://tea:tea_dev@localhost:5672',
  CORS_ORIGIN: 'http://localhost:3000',
  SMTP_URL: 'smtp://localhost:1025',
};
const compose = ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres'];
function command(bin, args, environment = process.env) {
  const r = spawnSync(bin, args, { cwd: root, env: environment, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Setup failed ${bin}: ${r.stderr.slice(-200)}`);
}
const children = [];
let db, orders, catalog, connection, channel;
async function waitFor(check, label) {
  for (let i = 0; i < 150; i++) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
async function start(service, port, database) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'apps', service),
    env: { ...env, PORT: String(port), DATABASE_URL: database },
    stdio: 'ignore',
  });
  child.service = service;
  children.push(child);
  await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`${service} exited`);
    try {
      return (await fetch(`http://127.0.0.1:${port}/health`)).ok;
    } catch {
      return false;
    }
  }, service);
}
async function http(
  route,
  { method = 'GET', body, status = 200, key, origin = true, cookie } = {},
) {
  const r = await fetch(`http://127.0.0.1:4400/api/v1${route}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(origin ? { origin: 'http://localhost:3000' } : {}),
      ...(key ? { 'idempotency-key': key } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  assert.equal(r.status, status, `${method} ${route.split('?')[0]}: ${data.code ?? r.status}`);
  return data;
}
function event(name, orderId, payload = {}) {
  return {
    eventId: randomUUID(),
    name,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    payload: { orderId, ...payload },
  };
}
function signed(payment, override = {}) {
  const data = Buffer.from(
    JSON.stringify({
      paymentId: payment.id,
      amount: payment.amount,
      currency: 'UAH',
      status: 'SUCCEEDED',
      providerPaymentId: `fake_${payment.id}`,
      ...override,
    }),
  ).toString('base64');
  return { data, signature: createHmac('sha256', secret).update(data).digest('base64') };
}
async function paymentFor(id) {
  return waitFor(() => db.payment.findFirst({ where: { orderId: id } }), 'payment ledger creation');
}
async function status(order, value) {
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: order.id } })).status === value,
    `order ${value}`,
  );
}
async function create(variantId, ownerCookie, extraItems = []) {
  const input = {
    items: [{ variantId, quantity: 1 }, ...extraItems],
    firstName: 'Тест',
    lastName: 'Оплати',
    phone: '+380501234567',
    email: `pay-${tag}@example.test`,
    delivery: { method: 'PICKUP', city: '', address: '' },
    paymentMethod: 'ONLINE_CARD',
    marketingConsent: false,
    acceptTerms: true,
  };
  const key = randomUUID();
  const created = await http(ownerCookie ? '/orders' : '/orders/guest', {
    method: 'POST',
    body: input,
    key,
    cookie: ownerCookie,
    status: 201,
  });
  await status(created.order, 'AWAITING_PAYMENT');
  const payment = await paymentFor(created.order.id);
  return { ...created, payment, input, key };
}
async function webhook(payment, override = {}, expected = 200) {
  return http('/payments/webhook/fake', {
    method: 'POST',
    body: signed(payment, override),
    origin: false,
    status: expected,
  });
}
async function reserved(productId, grams) {
  await waitFor(
    async () =>
      (await catalog.inventory.findUniqueOrThrow({ where: { productId } })).reservedGrams === grams,
    'stock reservation',
  );
}
try {
  for (const [s, name] of Object.entries(names)) {
    command('docker', [...compose, 'createdb', '-U', 'tea_bootstrap', '-O', s, name]);
    command('pnpm', ['--filter', `@tea/${s}-service`, 'exec', 'prisma', 'migrate', 'deploy'], {
      ...env,
      DATABASE_URL: urls[s],
    });
  }
  for (let i = 0; i < 2; i++)
    command('pnpm', ['--filter', '@tea/catalog-service', 'db:seed'], {
      ...env,
      DATABASE_URL: urls.catalog,
    });
  db = new PaymentsClient({ datasources: { db: { url: urls.payments } } });
  orders = new OrdersClient({ datasources: { db: { url: urls.orders } } });
  catalog = new CatalogClient({ datasources: { db: { url: urls.catalog } } });
  const product = await catalog.product.findUniqueOrThrow({
    where: { slug: 'tie-guan-yin' },
    include: { variants: { orderBy: { weightGrams: 'asc' } } },
  });
  const variantId = product.variants[0].id;
  await start('catalog-service', 4402, urls.catalog);
  await start('orders-service', 4403, urls.orders);
  await start('payments-service', 4404, urls.payments);
  await start('gateway', 4400, urls.orders);
  connection = await amqp.connect(env.RABBITMQ_URL);
  channel = await connection.createConfirmChannel();
  const first = await create(variantId);
  await reserved(product.id, 25);
  const replay = await http('/orders/guest', {
    method: 'POST',
    body: first.input,
    key: first.key,
    status: 201,
  });
  assert.equal(replay.order.id, first.order.id);
  await http('/payments/checkout', {
    method: 'POST',
    body: { number: first.order.number },
    status: 404,
  });
  await http('/payments/status?number=' + first.order.number, { status: 404 });
  await http('/payments/checkout', {
    method: 'POST',
    body: { number: first.order.number, token: 'x'.repeat(43) },
    status: 404,
  });
  await http('/payments/checkout', {
    method: 'POST',
    body: { number: first.order.number, token: first.accessToken },
    origin: false,
    status: 403,
  });
  const checkout = await http('/payments/checkout', {
    method: 'POST',
    body: { number: first.order.number, token: first.accessToken },
  });
  await http('/payments/checkout', {
    method: 'POST',
    body: { number: first.order.number, token: first.accessToken, amount: 1 },
    status: 400,
  });
  assert.equal(checkout.checkout.provider, 'FAKE');
  assert.equal(checkout.payment.amount, first.order.total);
  await http('/payments/webhook/fake', {
    method: 'POST',
    body: { ...signed(first.payment), signature: 'forged' },
    origin: false,
    status: 400,
  });
  await webhook(first.payment, { amount: first.payment.amount + 1 }, 400);
  assert.equal(await db.paymentEvent.count({ where: { signatureValid: false } }), 1);
  assert.equal(await db.paymentEvent.count({ where: { outcome: 'PAYMENT_MISMATCH' } }), 1);
  await Promise.all([webhook(first.payment), webhook(first.payment)]);
  await status(first.order, 'PAID');
  assert.equal(await db.outbox.count({ where: { eventName: 'PaymentSucceeded' } }), 1);
  assert.equal(await orders.outbox.count({ where: { eventName: 'OrderPaid' } }), 1);
  assert.equal(
    await orders.orderStatusHistory.count({ where: { orderId: first.order.id, status: 'PAID' } }),
    1,
  );
  await http('/orders/' + first.order.number + '/cancel?token=' + first.accessToken, {
    method: 'POST',
    body: {},
    status: 409,
  });
  const read = await http(
    '/payments/status?number=' + first.order.number + '&token=' + first.accessToken,
  );
  assert.equal(read.status, 'SUCCEEDED');
  const { JwtService } = requireAt('gateway')('@nestjs/jwt');
  const jwt = new JwtService();
  const owner = randomUUID(),
    other = randomUUID();
  const cookieFor = (id, role = 'CUSTOMER') =>
    'tea_access=' +
    jwt.sign(
      { sub: id, email: 'owner@example.test', role },
      { secret, algorithm: 'HS256', issuer: 'tea-auth', audience: 'tea-gateway', expiresIn: '15m' },
    );
  const owned = await create(variantId, cookieFor(owner));
  await http('/payments/status?number=' + owned.order.number, { cookie: cookieFor(owner) });
  await http('/payments/status?number=' + owned.order.number, {
    cookie: cookieFor(other),
    status: 404,
  });
  await http('/orders/' + owned.order.number + '/cancel', {
    method: 'POST',
    body: {},
    cookie: cookieFor(owner),
  });
  await reserved(product.id, 25);
  // A fresh client reads the same persisted result after the original caller disconnects.
  const reopened = new PaymentsClient({ datasources: { db: { url: urls.payments } } });
  assert.equal(
    (await reopened.payment.findUniqueOrThrow({ where: { id: first.payment.id } })).status,
    'SUCCEEDED',
  );
  await reopened.$disconnect();
  const second = await create(variantId);
  await http('/payments/checkout', {
    method: 'POST',
    body: { number: second.order.number, token: second.accessToken },
  });
  await http('/orders/' + second.order.number + '/cancel?token=' + second.accessToken, {
    method: 'POST',
    body: {},
  });
  await reserved(product.id, 25);
  await waitFor(
    async () =>
      (await db.payment.findUniqueOrThrow({ where: { id: second.payment.id } })).cancelRequested,
    'cancellation propagation',
  );
  await webhook(second.payment);
  await status(second.order, 'CANCELLED');
  await waitFor(
    async () =>
      (await db.payment.findUniqueOrThrow({ where: { id: second.payment.id } })).status ===
      'REFUNDED',
    'late success refund',
  );
  assert.equal(
    (await db.refund.findUniqueOrThrow({ where: { paymentId: second.payment.id } })).status,
    'COMPLETED',
  );
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: second.order.id } })).paymentStatus ===
      'REFUNDED',
    'order refund',
  );
  // Reordered success after refund must never overwrite the order's refunded payment state.
  const late = event('PaymentSucceeded', second.order.id, {
    paymentId: second.payment.id,
    amount: second.payment.amount,
    currency: 'UAH',
  });
  await new Promise((resolve, reject) =>
    channel.publish(
      `${namespace}.events`,
      'payments.payment_succeeded',
      Buffer.from(JSON.stringify(late)),
      { persistent: true },
      (e) => (e ? reject(e) : resolve()),
    ),
  );
  await waitFor(
    () => orders.processedEvent.findUnique({ where: { eventId: late.eventId } }),
    'late event',
  );
  assert.equal(
    (await orders.order.findUniqueOrThrow({ where: { id: second.order.id } })).paymentStatus,
    'REFUNDED',
  );
  const failed = await create(variantId);
  await http('/payments/simulate', {
    method: 'POST',
    body: { number: failed.order.number, token: failed.accessToken, outcome: 'FAILED' },
    origin: false,
    status: 403,
  });
  await http('/payments/simulate', {
    method: 'POST',
    body: { number: failed.order.number, outcome: 'FAILED' },
    status: 404,
  });
  await http('/payments/simulate', {
    method: 'POST',
    body: { number: failed.order.number, token: failed.accessToken, outcome: 'FAILED' },
  });
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: failed.order.id } })).paymentStatus ===
      'FAILED',
    'payment refusal',
  );
  await status(failed.order, 'AWAITING_PAYMENT');
  await reserved(product.id, 50);
  // A legacy stage-4a.2 order has an active attempt ID but no attempt-history row.
  await orders.paymentAttempt.delete({ where: { id: failed.payment.id } });
  const retryKey = randomUUID();
  const retryPath = '/orders/' + failed.order.number + '/payment/retry?token=' + failed.accessToken;
  const [retried, replayedRetry] = await Promise.all([
    http(retryPath, { method: 'POST', body: {}, key: retryKey }),
    http(retryPath, { method: 'POST', body: {}, key: retryKey }),
  ]);
  assert.equal(retried.paymentAttemptId, replayedRetry.paymentAttemptId);
  assert.notEqual(retried.paymentAttemptId, failed.payment.id);
  assert.equal(retried.paymentExpiresAt, failed.payment.expiresAt.toISOString());
  await waitFor(
    () => db.payment.findUnique({ where: { id: retried.paymentAttemptId } }),
    'new payment attempt',
  );
  assert.equal(await db.payment.count({ where: { orderId: failed.order.id } }), 2);
  assert.equal(await orders.paymentCommand.count({ where: { orderId: failed.order.id } }), 1);
  assert.equal(await orders.paymentAttempt.count({ where: { orderId: failed.order.id } }), 2);
  await webhook(failed.payment);
  await waitFor(
    async () =>
      (await db.payment.findUniqueOrThrow({ where: { id: failed.payment.id } })).status ===
      'REFUNDED',
    'old attempt late refund',
  );
  assert.equal(
    (await orders.order.findUniqueOrThrow({ where: { id: failed.order.id } })).status,
    'AWAITING_PAYMENT',
  );
  const codPath = '/orders/' + failed.order.number + '/payment/cod?token=' + failed.accessToken;
  await http(codPath, { method: 'POST', body: {}, key: retryKey, status: 409 });
  const codKey = randomUUID();
  const cod = await http(codPath, { method: 'POST', body: {}, key: codKey });
  assert.equal(cod.status, 'CONFIRMED');
  assert.equal(cod.paymentMethod, 'CASH_ON_DELIVERY');
  await http(codPath, { method: 'POST', body: {}, key: codKey });
  const abandoned = await db.payment.findUniqueOrThrow({ where: { id: retried.paymentAttemptId } });
  await waitFor(
    async () =>
      (await db.payment.findUniqueOrThrow({ where: { id: abandoned.id } })).cancelRequested,
    'attempt abandoned',
  );
  await webhook(abandoned);
  await waitFor(
    async () =>
      (await db.payment.findUniqueOrThrow({ where: { id: abandoned.id } })).status === 'REFUNDED',
    'COD race refund',
  );
  assert.equal(
    (await orders.order.findUniqueOrThrow({ where: { id: failed.order.id } })).status,
    'CONFIRMED',
  );
  await http('/orders/' + failed.order.number + '/cancel?token=' + failed.accessToken, {
    method: 'POST',
    body: {},
  });
  await reserved(product.id, 25);
  const expired = await create(variantId);
  await db.payment.update({ where: { id: expired.payment.id }, data: { expiresAt: new Date(0) } });
  await status(expired.order, 'CANCELLED');
  await reserved(product.id, 25);
  // Lost callback: the provider can still report success, and the same atomic store transition is used.
  const lost = await create(variantId);
  const provider = new FakePaymentProvider(secret);
  const intent = {
    paymentId: lost.payment.id,
    amount: lost.payment.amount,
    currency: 'UAH',
    orderNumber: lost.order.number,
    expiresAt: lost.payment.expiresAt.toISOString(),
    returnUrl: 'http://localhost:3000',
  };
  await provider.createCheckout(intent);
  provider.settle(intent.paymentId, 'SUCCEEDED');
  await db.payment.update({
    where: { id: intent.paymentId },
    data: { nextReconcileAt: new Date(0) },
  });
  await new MaintainPayments(new PrismaPaymentStore(db), provider).execute();
  await status(lost.order, 'PAID');
  // Cancellation before PaymentRequested leaves a durable tombstone, including duplicate deliveries.
  const store = new PrismaPaymentStore(db);
  const cancelledId = randomUUID();
  const cancel = event('OrderCancelled', cancelledId, { reason: 'CUSTOMER' });
  await store.cancel(cancel);
  await store.cancel(cancel);
  const request = event('PaymentRequested', cancelledId, {
    paymentId: randomUUID(),
    orderNumber: 'TE-' + 'A'.repeat(32),
    amount: 100,
    currency: 'UAH',
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  });
  await store.register(request);
  await store.register(request);
  assert.equal((await store.forOrder(cancelledId)).cancelRequested, true);
  // Inject an Outbox failure to prove the payment state and event roll back together.
  const rollbackId = randomUUID();
  await store.register(
    event('PaymentRequested', rollbackId, {
      paymentId: randomUUID(),
      orderNumber: 'TE-' + 'B'.repeat(32),
      amount: 100,
      currency: 'UAH',
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    }),
  );
  const rollback = await store.forOrder(rollbackId);
  const failing = db.$extends({
    query: {
      outbox: {
        create() {
          throw new Error('Injected Outbox failure');
        },
      },
    },
  });
  await assert.rejects(() =>
    new PrismaPaymentStore(failing).observe(
      { paymentId: rollback.id, amount: 100, currency: 'UAH', status: 'SUCCEEDED' },
      randomUUID(),
    ),
  );
  assert.equal((await store.find(rollback.id)).status, 'PENDING');
  // Ambiguous refund jobs are durably claimed once, never automatically resubmitted.
  children.find((c) => c.service === 'payments-service').kill('SIGSTOP');
  await db.refund.create({ data: { paymentId: rollback.id, amount: 100 } });
  const [claimA, claimB] = await Promise.all([store.claimRefund(), store.claimRefund()]);
  assert.equal([claimA, claimB].filter(Boolean).length, 1);
  await store.refundResult(rollback.id, 'REVIEW_REQUIRED', randomUUID());
  assert.equal(await store.claimRefund(), null);
  children.find((c) => c.service === 'payments-service').kill('SIGCONT');
  // Only server-confirmed online payment permits shipment; completion waits for inventory.
  const onlineFulfillment = await create(variantId);
  const adminCookie = cookieFor(randomUUID(), 'ADMIN');
  const path = `/admin/orders/${onlineFulfillment.order.id}/status`;
  await http(path, {
    method: 'PATCH',
    key: randomUUID(),
    cookie: adminCookie,
    body: {
      status: 'SHIPPED',
      expectedStatus: 'AWAITING_PAYMENT',
      reason: 'Unpaid shipment refused',
    },
    status: 409,
  });
  await webhook(onlineFulfillment.payment);
  await status(onlineFulfillment.order, 'PAID');
  await http(path, {
    method: 'PATCH',
    key: randomUUID(),
    cookie: adminCookie,
    body: { status: 'SHIPPED', expectedStatus: 'PAID', reason: 'Paid demonstration shipment' },
  });
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: onlineFulfillment.order.id } }))
        .stockDeductedAt,
    'online inventory acknowledgement',
  );
  const fulfilled = await http(path, {
    method: 'PATCH',
    key: randomUUID(),
    cookie: adminCookie,
    body: {
      status: 'COMPLETED',
      expectedStatus: 'SHIPPED',
      reason: 'Demonstration order received',
    },
  });
  assert.equal(fulfilled.status, 'COMPLETED');
  assert.equal(fulfilled.paymentStatus, 'PAID');
  for (const kind of ['SHIPPED', 'COMPLETED'])
    await waitFor(
      async () =>
        (
          await orders.orderPaymentNotice.findUnique({
            where: { dedupeKey: `order:${onlineFulfillment.order.id}:${kind}` },
          })
        )?.status === 'SENT',
      `online fulfillment ${kind} notification`,
    );
  // Stage 6.9: administrator cancellation before fulfillment reuses the durable refund saga.
  const pieceVariant = await catalog.productVariant.findFirstOrThrow({
    where: { weightGrams: null },
  });
  const pieceBefore = await catalog.inventory.findUniqueOrThrow({
    where: { productId: pieceVariant.productId },
  });
  const paidCancellation = await create(variantId, undefined, [
    { variantId: pieceVariant.id, quantity: 1 },
  ]);
  await http('/payments/simulate', {
    method: 'POST',
    body: {
      number: paidCancellation.order.number,
      token: paidCancellation.accessToken,
      outcome: 'SUCCEEDED',
    },
  });
  await status(paidCancellation.order, 'PAID');
  await waitFor(
    async () =>
      (
        await orders.orderPaymentNotice.findUnique({
          where: { paymentId_kind: { paymentId: paidCancellation.payment.id, kind: 'RECEIVED' } },
        })
      )?.status === 'SENT',
    'payment received SMTP delivery',
  );
  const cancelPath = `/admin/orders/${paidCancellation.order.id}/status`,
    cancelKey = randomUUID(),
    cancelBody = {
      status: 'CANCELLED',
      expectedStatus: 'PAID',
      reason: 'Demonstration customer requested cancellation before shipment',
    };
  await http(cancelPath, { method: 'PATCH', key: cancelKey, body: cancelBody, status: 401 });
  await http(cancelPath, {
    method: 'PATCH',
    key: cancelKey,
    cookie: cookieFor(owner),
    body: cancelBody,
    status: 403,
  });
  await http(cancelPath, { method: 'PATCH', cookie: adminCookie, body: cancelBody, status: 400 });
  await http(cancelPath, {
    method: 'PATCH',
    key: randomUUID(),
    cookie: adminCookie,
    body: { ...cancelBody, amount: 1 },
    status: 400,
  });
  await http(cancelPath, {
    method: 'PATCH',
    key: randomUUID(),
    cookie: adminCookie,
    body: { ...cancelBody, expectedStatus: 'AWAITING_PAYMENT' },
    status: 409,
  });
  const { PrismaAdminOrdersStore } = reqO(
    './dist/modules/administration/infrastructure/prisma-admin-orders-store',
  );
  // An audit or Outbox failure must roll back the status, history and publication together.
  for (const model of ['adminOrderCommand', 'outbox']) {
    const broken = orders.$extends({
      query: {
        [model]: {
          create() {
            throw new Error('Injected cancellation failure');
          },
        },
      },
    });
    await assert.rejects(
      new PrismaAdminOrdersStore(broken).transition(
        { ...cancelBody, id: paidCancellation.order.id, key: randomUUID() },
        owner,
        randomUUID(),
      ),
    );
    assert.equal(
      (await orders.order.findUniqueOrThrow({ where: { id: paidCancellation.order.id } })).status,
      'PAID',
    );
    assert.equal(
      await orders.orderStatusHistory.count({
        where: { orderId: paidCancellation.order.id, status: 'CANCELLED' },
      }),
      0,
    );
  }
  const cancellations = await Promise.all(
    Array.from({ length: 3 }, () =>
      http(cancelPath, { method: 'PATCH', key: cancelKey, cookie: adminCookie, body: cancelBody }),
    ),
  );
  assert.ok(cancellations.every((x) => x.status === 'CANCELLED'));
  await http(cancelPath, {
    method: 'PATCH',
    key: cancelKey,
    cookie: adminCookie,
    body: { ...cancelBody, reason: 'Changed reason' },
    status: 409,
  });
  await http(cancelPath, {
    method: 'PATCH',
    key: randomUUID(),
    cookie: adminCookie,
    body: cancelBody,
    status: 409,
  });
  const cancellationAudit = await orders.adminOrderCommand.findMany({
    where: { orderId: paidCancellation.order.id },
  });
  assert.equal(cancellationAudit.length, 1);
  assert.equal(cancellationAudit[0].reason, cancelBody.reason);
  const cancellationEvents = await orders.outbox.findMany({
    where: {
      eventName: 'OrderCancelled',
      payload: { path: ['payload', 'orderId'], equals: paidCancellation.order.id },
    },
  });
  assert.equal(cancellationEvents.length, 1);
  const cancellationEvent = cancellationEvents[0].payload;
  assert.equal(cancellationEvent.version, 2);
  assert.equal(cancellationEvent.payload.reason, 'ADMIN');
  assert.equal('reasonText' in cancellationEvent.payload, false);
  await waitFor(
    async () =>
      (await db.payment.findUniqueOrThrow({ where: { id: paidCancellation.payment.id } }))
        .status === 'REFUNDED',
    'administrator full refund',
  );
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: paidCancellation.order.id } }))
        .paymentStatus === 'REFUNDED',
    'refunded order projection',
  );
  assert.equal(
    (await db.refund.findUniqueOrThrow({ where: { paymentId: paidCancellation.payment.id } }))
      .amount,
    paidCancellation.order.total,
  );
  await waitFor(
    async () =>
      (
        await catalog.stockReservation.findUniqueOrThrow({
          where: { orderId: paidCancellation.order.id },
        })
      ).status === 'RELEASED',
    'administrator reservation release',
  );
  const pieceAfter = await catalog.inventory.findUniqueOrThrow({
    where: { productId: pieceVariant.productId },
  });
  assert.equal(pieceAfter.stockPieces, pieceBefore.stockPieces);
  assert.equal(pieceAfter.reservedPieces, pieceBefore.reservedPieces);
  await waitFor(
    async () =>
      (
        await orders.orderPaymentNotice.findUnique({
          where: { paymentId_kind: { paymentId: paidCancellation.payment.id, kind: 'REFUNDED' } },
        })
      )?.status === 'SENT',
    'payment refunded SMTP delivery',
  );
  const mail = await (await fetch('http://127.0.0.1:8025/api/v1/messages')).json();
  for (const title of ['Оплату отримано', 'Повернення оплати підтверджено']) {
    assert.ok(
      mail.messages.some(
        (x) => x.Subject.includes(paidCancellation.order.number) && x.Subject.includes(title),
      ),
      'transactional message captured by Mailpit',
    );
  }
  // Duplicate cancellation delivery and delayed payment-success never reopen the order or refund twice.
  for (const queue of ['catalog.order_cancelled', 'payments.order_cancelled']) {
    await channel.sendToQueue(
      `${namespace}.${queue}`,
      Buffer.from(JSON.stringify(cancellationEvent)),
      { persistent: true },
    );
  }
  await channel.waitForConfirms();
  const lateSuccess = event('PaymentSucceeded', paidCancellation.order.id, {
    paymentId: paidCancellation.payment.id,
    amount: paidCancellation.order.total,
    currency: 'UAH',
  });
  channel.sendToQueue(
    `${namespace}.orders.payment_succeeded`,
    Buffer.from(JSON.stringify(lateSuccess)),
    { persistent: true },
  );
  await channel.waitForConfirms();
  await waitFor(
    () => orders.processedEvent.findUnique({ where: { eventId: lateSuccess.eventId } }),
    'delayed success after refund',
  );
  const afterRefund = await http(`/admin/orders/${paidCancellation.order.id}`, {
    cookie: adminCookie,
  });
  assert.equal(afterRefund.status, 'CANCELLED');
  assert.equal(afterRefund.paymentStatus, 'REFUNDED');
  assert.equal(await db.refund.count({ where: { paymentId: paidCancellation.payment.id } }), 1);
  assert.equal(
    await orders.orderPaymentNotice.count({ where: { paymentId: paidCancellation.payment.id } }),
    2,
  );
  await http(path, {
    method: 'PATCH',
    key: randomUUID(),
    cookie: adminCookie,
    body: { ...cancelBody, expectedStatus: 'COMPLETED' },
    status: 409,
  });
  // Competing shipment/cancellation commands serialize under the same order lock.
  const racing = await create(variantId);
  await http('/payments/simulate', {
    method: 'POST',
    body: { number: racing.order.number, token: racing.accessToken, outcome: 'SUCCEEDED' },
  });
  await status(racing.order, 'PAID');
  const transitions = new PrismaAdminOrdersStore(orders),
    raceResults = await Promise.allSettled(
      ['SHIPPED', 'CANCELLED'].map((status) =>
        transitions.transition(
          {
            id: racing.order.id,
            status,
            expectedStatus: 'PAID',
            reason: 'Race acceptance check',
            key: randomUUID(),
          },
          owner,
          randomUUID(),
        ),
      ),
    );
  assert.equal(raceResults.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(await orders.adminOrderCommand.count({ where: { orderId: racing.order.id } }), 1);
  const winner = await orders.order.findUniqueOrThrow({ where: { id: racing.order.id } });
  if (winner.status === 'SHIPPED') {
    await waitFor(
      async () =>
        (await catalog.stockReservation.findUniqueOrThrow({ where: { orderId: racing.order.id } }))
          .status === 'CONSUMED',
      'shipment race winner',
    );
    assert.equal(await db.refund.count({ where: { paymentId: racing.payment.id } }), 0);
  } else {
    assert.equal(winner.status, 'CANCELLED');
    await waitFor(
      async () =>
        (await catalog.stockReservation.findUniqueOrThrow({ where: { orderId: racing.order.id } }))
          .status === 'RELEASED',
      'cancellation race winner',
    );
  }
  console.log(
    'Paid cancellation integration passed: ADMIN-only, strict commands, atomic audit/Outbox rollback, concurrent replay, v2 cancellation, one full refund, reservation release, delayed success and shipment/cancellation race.',
  );
  // Deterministic local queue acceptance: no worker can claim the fixtures created after this pause.
  const ordersChild = children.find((c) => c.service === 'orders-service');
  ordersChild.kill('SIGSTOP');
  try {
    const { PrismaOrderStore } = reqO('./dist/modules/orders/infrastructure/prisma-order-store');
    const { PrismaPaymentNoticeStore } = reqO(
      './dist/modules/notifications/infrastructure/prisma-payment-notice-store',
    );
    const source = await orders.order.findUniqueOrThrow({
      where: { id: paidCancellation.order.id },
    });
    const fixtureId = randomUUID(),
      fixturePayment = randomUUID();
    await orders.order.create({
      data: {
        ...source,
        id: fixtureId,
        number: 'TE-' + fixtureId.replaceAll('-', '').toUpperCase(),
        status: 'AWAITING_PAYMENT',
        paymentStatus: 'UNPAID',
        paymentAttemptId: fixturePayment,
        idempotencyHash: randomBytes(32).toString('hex'),
        requestHash: randomBytes(32).toString('hex'),
        receiptSentAt: new Date(),
      },
    });
    await orders.paymentAttempt.create({ data: { id: fixturePayment, orderId: fixtureId } });
    const success = event('PaymentSucceeded', fixtureId, {
      paymentId: fixturePayment,
      amount: source.total,
      currency: 'UAH',
    });
    const broken = orders.$extends({
      query: {
        orderPaymentNotice: {
          upsert() {
            throw new Error('Injected notification queue failure');
          },
        },
      },
    });
    await assert.rejects(new PrismaOrderStore(broken).handle(success));
    assert.equal(
      (await orders.order.findUniqueOrThrow({ where: { id: fixtureId } })).status,
      'AWAITING_PAYMENT',
    );
    assert.equal(
      await orders.processedEvent.findUnique({ where: { eventId: success.eventId } }),
      null,
    );
    assert.equal(
      (await orders.paymentAttempt.findUniqueOrThrow({ where: { id: fixturePayment } })).status,
      'PENDING',
    );
    const localOrders = new PrismaOrderStore(orders),
      notices = new PrismaPaymentNoticeStore(orders);
    await localOrders.handle(success);
    await localOrders.handle(success);
    await localOrders.handle({ ...success, eventId: randomUUID() });
    assert.equal(
      await orders.orderPaymentNotice.count({ where: { paymentId: fixturePayment } }),
      1,
    );
    let notice = await orders.orderPaymentNotice.findUniqueOrThrow({
      where: { paymentId_kind: { paymentId: fixturePayment, kind: 'RECEIVED' } },
    });
    const past = new Date('2000-01-01T00:00:00Z');
    await orders.orderPaymentNotice.update({
      where: { id: notice.id },
      data: { nextAttemptAt: past },
    });
    const claims = await Promise.all([notices.claim(), notices.claim()]);
    const claimed = claims.find((x) => x?.id === notice.id);
    assert.ok(claimed);
    assert.equal(claims.filter((x) => x?.id === notice.id).length, 1);
    await notices.finish(notice.id, claimed.leaseId, false);
    notice = await orders.orderPaymentNotice.findUniqueOrThrow({ where: { id: notice.id } });
    assert.equal(notice.status, 'PENDING');
    assert.equal(notice.attempts, 1);
    assert.ok(notice.nextAttemptAt > new Date());
    await orders.orderPaymentNotice.update({
      where: { id: notice.id },
      data: { nextAttemptAt: past },
    });
    const retry = await notices.claim();
    assert.equal(retry.id, notice.id);
    await notices.finish(notice.id, claimed.leaseId, true);
    assert.equal(
      (await orders.orderPaymentNotice.findUniqueOrThrow({ where: { id: notice.id } })).status,
      'PENDING',
    );
    await notices.finish(notice.id, retry.leaseId, false);
    await orders.orderPaymentNotice.update({
      where: { id: notice.id },
      data: { nextAttemptAt: past },
    });
    const last = await notices.claim();
    assert.equal(last.id, notice.id);
    await notices.finish(notice.id, last.leaseId, false);
    assert.equal(
      (await orders.orderPaymentNotice.findUniqueOrThrow({ where: { id: notice.id } })).status,
      'FAILED',
    );
    const recovered = await orders.orderPaymentNotice.create({
      data: {
        orderId: fixtureId,
        paymentId: randomUUID(),
        kind: 'REFUNDED',
        amount: source.total,
        nextAttemptAt: past,
        leaseId: randomUUID(),
        leaseUntil: past,
        attempts: 1,
      },
    });
    const recoveredLease = await notices.claim();
    assert.equal(recoveredLease.id, recovered.id);
    assert.notEqual(recoveredLease.leaseId, recovered.leaseId);
    await notices.finish(recovered.id, recovered.leaseId, true);
    assert.equal(
      (await orders.orderPaymentNotice.findUniqueOrThrow({ where: { id: recovered.id } })).status,
      'PENDING',
    );
    await notices.finish(recovered.id, recoveredLease.leaseId, true);
    assert.equal(
      (await orders.orderPaymentNotice.findUniqueOrThrow({ where: { id: recovered.id } })).status,
      'SENT',
    );
    const exhausted = await orders.orderPaymentNotice.create({
      data: {
        orderId: fixtureId,
        paymentId: randomUUID(),
        kind: 'RECEIVED',
        amount: source.total,
        nextAttemptAt: past,
        leaseId: randomUUID(),
        leaseUntil: past,
        attempts: 3,
      },
    });
    await notices.claim();
    assert.equal(
      (await orders.orderPaymentNotice.findUniqueOrThrow({ where: { id: exhausted.id } })).status,
      'FAILED',
    );
    // A known obsolete attempt still receives its own money notification, never changes active state.
    const older = randomUUID();
    await orders.paymentAttempt.create({ data: { id: older, orderId: fixtureId } });
    const refund = event('PaymentRefunded', fixtureId, {
      paymentId: older,
      amount: source.total,
      currency: 'UAH',
    });
    await localOrders.handle(refund);
    await localOrders.handle({
      ...success,
      eventId: randomUUID(),
      payload: { ...success.payload, paymentId: older },
    });
    assert.equal(
      await orders.orderPaymentNotice.count({ where: { paymentId: older, kind: 'RECEIVED' } }),
      0,
    );
    assert.equal(
      await orders.orderPaymentNotice.count({ where: { paymentId: older, kind: 'REFUNDED' } }),
      1,
    );
    assert.equal(
      (await orders.order.findUniqueOrThrow({ where: { id: fixtureId } })).paymentStatus,
      'PAID',
    );
  } finally {
    ordersChild.kill('SIGCONT');
  }
  console.log(
    'Payment email integration passed: actual SMTP receipt/refund without marketing consent, semantic/event deduplication, atomic rollback, concurrent claims, bounded retries, lease recovery, stale acknowledgement and reordered historical refunds.',
  );
  const paymentActor = randomUUID(),
    paymentAdminCookie = cookieFor(paymentActor, 'ADMIN');
  await http('/admin/payments', { status: 401 });
  await http('/admin/payments', { cookie: cookieFor(owner), status: 403 });
  await http('/admin/payments/events', { cookie: cookieFor(owner), status: 403 });
  await http('/admin/payments?page=0', { cookie: paymentAdminCookie, status: 400 });
  await http('/admin/payments?status=invalid', { cookie: paymentAdminCookie, status: 400 });
  await http('/admin/payments?from=2026-11-06T00:00:00Z&to=2026-11-05T00:00:00Z', {
    cookie: paymentAdminCookie,
    status: 400,
  });
  const adminTag = 'ADMIN-' + tag + '%_',
    adminRows = Array.from({ length: 24 }, (_, i) => ({
      id: randomUUID(),
      orderId: randomUUID(),
      orderNumber: adminTag + i,
      amount: 10000 + i,
      currency: 'UAH',
      provider: i === 22 ? 'LIQPAY' : 'FAKE',
      status: i === 23 ? 'REFUNDED' : 'SUCCEEDED',
      paidAt: new Date('2020-01-01T12:00:00Z'),
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      nextReconcileAt: new Date('2099-01-01T00:00:00Z'),
      createdAt: new Date('2020-01-01T12:00:00Z'),
    }));
  await db.payment.createMany({ data: adminRows });
  const target = adminRows[0],
    refundRow = await db.refund.create({
      data: { paymentId: target.id, amount: target.amount, status: 'REVIEW_REQUIRED' },
    });
  const auditRows = Array.from({ length: 21 }, (_, i) => ({
    id: randomUUID(),
    paymentId: target.id,
    rawPayload: {
      data: 'private-data-marker',
      signature: 'private-signature-marker',
      card: 'private-card-marker',
    },
    signatureValid: i % 2 === 1,
    outcome: i % 2 === 1 ? 'APPLIED' : 'INVALID_SIGNATURE',
    createdAt: new Date('2020-01-01T12:00:00Z'),
  }));
  await db.paymentEvent.createMany({ data: auditRows });
  const unassigned = await db.paymentEvent.create({
    data: {
      rawPayload: { signature: 'private-signature-marker' },
      signatureValid: false,
      outcome: 'INVALID_SIGNATURE',
    },
  });
  const listPath = '/admin/payments?q=' + encodeURIComponent(adminTag),
    pageA = await http(listPath, { cookie: paymentAdminCookie }),
    pageB = await http(listPath + '&page=2', { cookie: paymentAdminCookie });
  assert.equal(pageA.total, 24);
  assert.equal(pageA.items.length, 20);
  assert.equal(pageB.items.length, 4);
  assert.equal(new Set([...pageA.items, ...pageB.items].map((x) => x.id)).size, 24);
  assert.equal(
    (await http('/admin/payments?q=' + target.id, { cookie: paymentAdminCookie })).total,
    1,
  );
  assert.equal(
    (await http(listPath + '&provider=LIQPAY', { cookie: paymentAdminCookie })).total,
    1,
  );
  assert.equal(
    (await http(listPath + '&status=REFUNDED', { cookie: paymentAdminCookie })).total,
    1,
  );
  assert.equal(
    (await http(listPath + '&refundOnly=true', { cookie: paymentAdminCookie })).total,
    1,
  );
  assert.equal(
    (await http(listPath + '&to=2020-01-01T12:00:00Z', { cookie: paymentAdminCookie })).total,
    0,
  );
  assert.equal((await http(listPath + '&page=999', { cookie: paymentAdminCookie })).total, 24);
  const detail = await http('/admin/payments/' + target.id, { cookie: paymentAdminCookie });
  assert.equal(detail.refund.id, refundRow.id);
  assert.equal(detail.refund.status, 'REVIEW_REQUIRED');
  assert.equal(detail.payment.refundStatus, 'REVIEW_REQUIRED');
  await http('/admin/payments/' + randomUUID(), { cookie: paymentAdminCookie, status: 404 });
  const e1 = await http('/admin/payments/events?paymentId=' + target.id, {
      cookie: paymentAdminCookie,
    }),
    e2 = await http('/admin/payments/events?paymentId=' + target.id + '&page=2', {
      cookie: paymentAdminCookie,
    });
  assert.equal(e1.total, 21);
  assert.equal(e1.items.length, 20);
  assert.equal(e2.items.length, 1);
  assert.equal(
    (
      await http('/admin/payments/events?paymentId=' + target.id + '&signatureValid=false', {
        cookie: paymentAdminCookie,
      })
    ).total,
    11,
  );
  const globalEvents = await http('/admin/payments/events?signatureValid=false', {
    cookie: paymentAdminCookie,
  });
  assert.ok(globalEvents.items.some((x) => x.id === unassigned.id && x.paymentId === null));
  for (const x of [pageA, detail, e1, globalEvents])
    for (const marker of [
      'private-data-marker',
      'private-signature-marker',
      'private-card-marker',
      'rawPayload',
    ])
      assert.equal(JSON.stringify(x).includes(marker), false);
  const reconcilePath = '/admin/payments/' + target.id + '/reconcile',
    reconcileInput = { expectedStatus: 'SUCCEEDED', reason: 'Review provider outcome' },
    commandKey = randomUUID();
  await http(reconcilePath, {
    method: 'POST',
    body: reconcileInput,
    key: randomUUID(),
    cookie: cookieFor(owner),
    status: 403,
  });
  await http(reconcilePath, {
    method: 'POST',
    body: { ...reconcileInput, amount: 1 },
    key: randomUUID(),
    cookie: paymentAdminCookie,
    status: 400,
  });
  await http(reconcilePath, {
    method: 'POST',
    body: { ...reconcileInput, expectedStatus: 'PENDING' },
    key: randomUUID(),
    cookie: paymentAdminCookie,
    status: 409,
  });
  const receipt = await http(reconcilePath, {
    method: 'POST',
    body: reconcileInput,
    key: commandKey,
    cookie: paymentAdminCookie,
    status: 202,
  });
  assert.equal(receipt.status, 'QUEUED');
  assert.deepEqual(
    await http(reconcilePath, {
      method: 'POST',
      body: reconcileInput,
      key: commandKey,
      cookie: paymentAdminCookie,
      status: 202,
    }),
    receipt,
  );
  await http(reconcilePath, {
    method: 'POST',
    body: { ...reconcileInput, reason: 'Different intent' },
    key: commandKey,
    cookie: paymentAdminCookie,
    status: 409,
  });
  await http('/admin/payments/' + adminRows[22].id + '/reconcile', {
    method: 'POST',
    body: reconcileInput,
    key: randomUUID(),
    cookie: paymentAdminCookie,
    status: 409,
  });
  await http('/admin/payments/' + adminRows[23].id + '/reconcile', {
    method: 'POST',
    body: { ...reconcileInput, expectedStatus: 'REFUNDED' },
    key: randomUUID(),
    cookie: paymentAdminCookie,
    status: 409,
  });
  const adminCommands = await http('/admin/payments/' + target.id + '/commands', {
    cookie: paymentAdminCookie,
  });
  assert.equal(adminCommands.total, 1);
  assert.equal(adminCommands.items[0].actorId, paymentActor);
  assert.equal(adminCommands.items[0].reason, reconcileInput.reason);
  assert.equal(adminCommands.items[0].key, undefined);
  const paymentChild = children.find((c) => c.service === 'payments-service');
  paymentChild.kill('SIGSTOP');
  try {
    const raceTarget = {
      ...target,
      id: randomUUID(),
      orderId: randomUUID(),
      orderNumber: adminTag + 'race',
    };
    await db.payment.create({ data: raceTarget });
    const { PrismaAdminPaymentsStore } = reqP(
      './dist/modules/administration/infrastructure/prisma-admin-payments-store',
    );
    const adminStore = new PrismaAdminPaymentsStore(db),
      manualStore = new PrismaPaymentStore(db);
    const first = await adminStore.reconcile(
      { paymentId: raceTarget.id, ...reconcileInput, key: randomUUID() },
      paymentActor,
    );
    const captured = (await manualStore.due()).find((x) => x.id === raceTarget.id);
    assert.ok(captured.reconcileCommandIds.includes(first.id));
    const later = await adminStore.reconcile(
      { paymentId: raceTarget.id, ...reconcileInput, key: randomUUID() },
      paymentActor,
    );
    await manualStore.defer(raceTarget.id, captured.reconcileCommandIds);
    assert.ok(
      (await db.paymentAdminCommand.findUniqueOrThrow({ where: { id: first.id } })).attemptedAt,
    );
    assert.equal(
      (await db.paymentAdminCommand.findUniqueOrThrow({ where: { id: later.id } })).attemptedAt,
      null,
    );
    assert.ok(
      (await db.payment.findUniqueOrThrow({ where: { id: raceTarget.id } })).nextReconcileAt >
        new Date(),
    );
    const next = (await manualStore.due()).find((x) => x.id === raceTarget.id);
    assert.ok(next.reconcileCommandIds.includes(later.id));
    await manualStore.defer(raceTarget.id, next.reconcileCommandIds);
    const beforeSchedule = (await db.payment.findUniqueOrThrow({ where: { id: raceTarget.id } }))
      .nextReconcileAt;
    const failureKey = randomUUID(),
      brokenAdmin = new PrismaAdminPaymentsStore(
        db.$extends({
          query: {
            paymentAdminCommand: {
              create() {
                throw new Error('Injected admin audit failure');
              },
            },
          },
        }),
      );
    await assert.rejects(() =>
      brokenAdmin.reconcile(
        { paymentId: raceTarget.id, ...reconcileInput, key: failureKey },
        paymentActor,
      ),
    );
    assert.equal(
      (
        await db.payment.findUniqueOrThrow({ where: { id: raceTarget.id } })
      ).nextReconcileAt.getTime(),
      beforeSchedule.getTime(),
    );
    assert.equal(await db.paymentAdminCommand.count({ where: { key: failureKey } }), 0);
  } finally {
    paymentChild.kill('SIGCONT');
  }
  console.log(
    'Payment administration integration passed: strict ADMIN access, literal/date/status/provider/refund filters, stable pagination, metadata-only webhook audit, unattributed invalid callbacks, queued/idempotent reconciliation, inactive/terminal conflicts, captured-command acknowledgement, schedule-race recovery and atomic audit rollback.',
  );
  console.log(
    'Payments integration passed: fresh migrations, repeatable catalog seed, guest/owner access boundary, signed/raw webhook audit, concurrent duplicates, atomic Outbox rollback, paid state, expiry and stock compensation, late-success refund, refund reordering, lost callback reconciliation, durable tombstones, idempotent retry/COD commands, legacy attempt recovery, unchanged deadlines, abandoned-attempt refund races and claimed refund quarantine.',
  );
} finally {
  for (const child of children)
    if (child.exitCode === null) {
      child.kill('SIGCONT');
      child.kill('SIGTERM');
    }
  await Promise.all(
    children.map(async (c) => {
      if (c.exitCode !== null) return;
      await Promise.race([once(c, 'exit'), new Promise((r) => setTimeout(r, 5000))]);
      if (c.exitCode === null) c.kill('SIGKILL');
    }),
  );
  if (channel) {
    for (const [q] of CHECKOUT_SUBSCRIPTIONS)
      for (const suffix of ['', '.retry', '.dlq'])
        await channel.deleteQueue(`${namespace}.${q}${suffix}`).catch(() => {});
    for (const queue of [env.PAYMENTS_RPC_QUEUE, env.ORDERS_RPC_QUEUE, env.CATALOG_RPC_QUEUE])
      await channel.deleteQueue(queue).catch(() => {});
    for (const exchange of [`${namespace}.events`, `${namespace}.events.dlx`])
      await channel.deleteExchange(exchange).catch(() => {});
    await channel.close();
  }
  await connection?.close();
  await db?.$disconnect();
  await orders?.$disconnect();
  await catalog?.$disconnect();
  for (const name of Object.values(names))
    command('docker', [
      ...compose,
      'dropdb',
      '--if-exists',
      '--force',
      '-U',
      'tea_bootstrap',
      name,
    ]);
}
