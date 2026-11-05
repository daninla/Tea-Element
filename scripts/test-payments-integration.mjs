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
async function create(variantId, ownerCookie) {
  const input = {
    items: [{ variantId, quantity: 1 }],
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
