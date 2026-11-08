import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url)),
  req = createRequire(path.join(root, 'apps/marketing-service/package.json'));
const tag = randomUUID().replaceAll('-', ''),
  namespace = 'stage7-' + tag,
  name = 'marketing_stage7_' + tag,
  secret = randomBytes(48).toString('hex');
const url = `postgresql://marketing:tea_dev_marketing@localhost:5433/${name}`,
  now = new Date(),
  day = 86400000;
Object.assign(process.env, {
  MARKETING_UNSUBSCRIBE_SECRET: secret,
  MARKETING_WINBACK_ENABLED: 'true',
});
const env = {
  ...process.env,
  NODE_ENV: 'development',
  LOG_LEVEL: 'silent',
  DATABASE_URL: url,
  EVENTS_NAMESPACE: namespace,
  MARKETING_RPC_QUEUE: namespace + '.marketing.rpc',
  JWT_ACCESS_SECRET: secret,
  RABBITMQ_URL: 'amqp://tea:tea_dev@localhost:5672',
  CORS_ORIGIN: 'http://localhost:3000',
  MARKETING_WINBACK_ENABLED: 'false',
};
const { PrismaClient } = req('./generated/prisma');
const { PrismaCampaignStore } = req(
  './dist/modules/campaigns/infrastructure/prisma-campaign-store',
);
const { SmtpCampaignMailer } = req('./dist/modules/campaigns/infrastructure/smtp-campaign-mailer');
const { unsubscribeToken } = req('./dist/modules/campaigns/infrastructure/unsubscribe-token');
const amqp = req('amqplib'),
  children = [];
let db, connection, channel, smtp;
const compose = ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres'];
function command(bin, args, environment = process.env) {
  const r = spawnSync(bin, args, { cwd: root, env: environment, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Setup failed ${bin}: ${r.stderr.slice(-200)}`);
}
async function waitFor(check, label) {
  for (let i = 0; i < 150; i++) {
    const v = await check();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out: ' + label);
}
async function start(service, port) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'apps', service),
    env: { ...env, PORT: String(port) },
    stdio: 'ignore',
  });
  child.service = service;
  children.push(child);
  await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(service + ' exited');
    try {
      return (await fetch(`http://localhost:${port}/health`)).ok;
    } catch {
      return false;
    }
  }, service);
  return child;
}
async function http(body, status = 200, origin = true) {
  const r = await fetch('http://localhost:4500/api/v1/marketing/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin: env.CORS_ORIGIN } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const v = await r.json();
  assert.equal(r.status, status, v.code ?? 'unsubscribe response');
  return v;
}
const date = (days) => new Date(now.getTime() - days * day).toISOString();
function registration(email, consent = true) {
  return {
    eventId: randomUUID(),
    version: 1,
    name: 'UserRegistered',
    occurredAt: date(100),
    correlationId: tag,
    payload: {
      userId: randomUUID(),
      email,
      firstName: 'Демо',
      lastName: 'Маркетинг',
      marketingConsent: consent,
    },
  };
}
function purchase(email, days = 50, extra = {}) {
  return {
    eventId: randomUUID(),
    version: 1,
    name: 'OrderCompleted',
    occurredAt: date(days),
    correlationId: tag,
    payload: {
      orderId: randomUUID(),
      userId: null,
      email,
      firstName: 'Демо',
      lastName: 'Маркетинг',
      marketingConsent: true,
      marketingConsentAt: date(100),
      total: 10000,
      items: [{ productId: randomUUID(), quantity: 1 }],
      ...extra,
    },
  };
}
async function publish(event, key) {
  await new Promise((resolve, reject) =>
    channel.publish(
      namespace + '.events',
      key,
      Buffer.from(JSON.stringify(event)),
      { persistent: true },
      (e) => (e ? reject(e) : resolve()),
    ),
  );
}
try {
  command('docker', [...compose, 'createdb', '-U', 'tea_bootstrap', '-O', 'marketing', name]);
  command(
    'pnpm',
    ['--filter', '@tea/marketing-service', 'exec', 'prisma', 'migrate', 'deploy'],
    env,
  );
  db = new PrismaClient({ datasources: { db: { url } } });
  smtp = new SmtpCampaignMailer();
  const sent = [];
  const store = new PrismaCampaignStore(db, {
    send: async (m) => {
      sent.push(m);
      await smtp.send(m);
    },
  });
  const child = await start('marketing-service', 4505);
  await start('gateway', 4500);
  connection = await amqp.connect(env.RABBITMQ_URL);
  channel = await connection.createConfirmChannel();
  await channel.assertExchange(namespace + '.events', 'topic', { durable: true });
  await channel.assertExchange(namespace + '.events.dlx', 'topic', { durable: true });
  for (const [queue, key] of [
    ['marketing.user_registered', 'auth.user_registered'],
    ['marketing.order_completed', 'orders.order_completed'],
  ]) {
    await channel.assertQueue(namespace + '.' + queue, {
      durable: true,
      deadLetterExchange: namespace + '.events.dlx',
      deadLetterRoutingKey: key,
    });
    await channel.bindQueue(namespace + '.' + queue, namespace + '.events', key);
  }
  const email = `campaign-${tag}@example.test`,
    reg = registration(email),
    order = purchase(email);
  await Promise.all([publish(reg, 'auth.user_registered'), publish(reg, 'auth.user_registered')]);
  await waitFor(
    () => db.marketingRegistration.findUnique({ where: { id: reg.payload.userId } }),
    'registration projection',
  );
  await publish(order, 'orders.order_completed');
  await waitFor(
    () => db.marketingPurchase.findUnique({ where: { id: order.payload.orderId } }),
    'purchase projection',
  );
  await store.ingest({ ...reg, eventId: randomUUID() });
  await store.ingest({ ...order, eventId: randomUUID() });
  assert.equal(await db.customerProfile.count({ where: { email } }), 1);
  assert.equal(await db.marketingPurchase.count(), 1);
  const declined = registration(`declined-${tag}@example.test`, false);
  await store.ingest(declined);
  await store.ingest(purchase(declined.payload.email));
  assert.equal(await db.marketingPurchase.count(), 1);
  const legacy = purchase(`legacy-${tag}@example.test`);
  delete legacy.payload.marketingConsentAt;
  await store.ingest(legacy);
  assert.equal(await db.customerProfile.count({ where: { email: legacy.payload.email } }), 0);
  const noConsent = purchase(`no-consent-${tag}@example.test`, 50, { marketingConsent: false });
  delete noConsent.payload.marketingConsentAt;
  await store.ingest(noConsent);
  assert.equal(await db.customerProfile.count({ where: { email: noConsent.payload.email } }), 0);
  const slow = registration(`slow-${tag}@example.test`);
  await store.ingest(slow);
  await store.ingest(purchase(slow.payload.email, 80));
  await store.ingest(purchase(slow.payload.email, 40));
  const broken = db.$extends({
      query: {
        processedEvent: {
          create() {
            throw new Error('injected projection failure');
          },
        },
      },
    }),
    rollback = registration(`rollback-${tag}@example.test`);
  await assert.rejects(() =>
    new PrismaCampaignStore(broken, { send: async () => {} }).ingest(rollback),
  );
  assert.equal(await db.customerProfile.count({ where: { email: rollback.payload.email } }), 0);
  await Promise.all([store.schedule(now), store.schedule(now)]);
  assert.equal(await db.emailLog.count(), 1);
  await Promise.all([store.deliver(now), store.deliver(now)]);
  assert.equal(sent.length, 1);
  let job = await db.emailLog.findFirstOrThrow();
  assert.equal(job.status, 'SENT');
  assert.equal(job.attempts, 1);
  const mail = await (await fetch('http://localhost:8025/api/v1/messages')).json();
  assert.ok(
    mail.messages.some(
      (x) =>
        x.Subject.includes('Час для нового чайного ритуалу') &&
        JSON.stringify(x.To).includes(email),
    ),
  );
  await store.ingest(purchase(email, 35));
  await store.schedule(now);
  assert.equal(await db.emailLog.count(), 1);
  await store.schedule(new Date(now.getTime() + 8 * day));
  assert.equal(await db.emailLog.count(), 2);
  const token = new URL(sent[0].unsubscribeUrl).hash.slice('#token='.length),
    profile = await db.customerProfile.findUniqueOrThrow({ where: { email } });
  assert.equal((await fetch('http://localhost:4500/api/v1/marketing/unsubscribe')).status, 404);
  await http({ token }, 403, false);
  await http({ token, email }, 400);
  await http({ token: profile.id + '.' + 'a'.repeat(43) }, 400);
  await http({ token });
  await http({ token });
  assert.equal(
    (await db.customerProfile.findUniqueOrThrow({ where: { id: profile.id } })).consent,
    false,
  );
  assert.equal(await db.marketingPurchase.count({ where: { profileId: profile.id } }), 0);
  assert.equal(await db.emailLog.count({ where: { profileId: profile.id, status: 'PENDING' } }), 0);
  await store.ingest({ ...order, eventId: randomUUID() });
  await store.ingest({ ...reg, eventId: randomUUID() });
  assert.equal(
    (await db.customerProfile.findUniqueOrThrow({ where: { id: profile.id } })).consent,
    false,
  );
  assert.equal(await db.marketingPurchase.count({ where: { profileId: profile.id } }), 0);
  const renewed = purchase(email, 0, {
    marketingConsentAt: new Date(Date.now() + 500).toISOString(),
  });
  renewed.occurredAt = new Date(Date.now() + 1000).toISOString();
  await store.ingest(renewed);
  assert.equal(
    (await db.customerProfile.findUniqueOrThrow({ where: { id: profile.id } })).consent,
    true,
  );
  await store.unsubscribe(token);
  const stale = registration(`stale-${tag}@example.test`);
  await store.ingest(stale);
  await store.ingest(purchase(stale.payload.email));
  await store.schedule(now);
  await store.ingest(purchase(stale.payload.email, 1));
  await store.deliver(now);
  assert.equal(sent.length, 1);
  const failed = registration(`failed-${tag}@example.test`);
  await store.ingest(failed);
  await store.ingest(purchase(failed.payload.email));
  await store.schedule(now);
  let failedCalls = 0;
  const failing = new PrismaCampaignStore(db, {
    send: async () => {
      failedCalls++;
      throw new Error('private SMTP error');
    },
  });
  await failing.deliver(now);
  await failing.deliver(now);
  assert.equal(failedCalls, 1);
  await failing.deliver(new Date(now.getTime() + 5000));
  await failing.deliver(new Date(now.getTime() + 15000));
  assert.equal(failedCalls, 3);
  const failedProfile = await db.customerProfile.findUniqueOrThrow({
    where: { email: failed.payload.email },
  });
  assert.equal(
    (await db.emailLog.findFirstOrThrow({ where: { profileId: failedProfile.id } })).status,
    'FAILED',
  );
  // An unsubscribe request waits for in-flight SMTP submission under the same profile lock.
  const racing = registration(`race-${tag}@example.test`);
  await store.ingest(racing);
  await store.ingest(purchase(racing.payload.email));
  await store.schedule(now);
  const racingProfile = await db.customerProfile.findUniqueOrThrow({
    where: { email: racing.payload.email },
  });
  let enter, release;
  const entered = new Promise((r) => {
      enter = r;
    }),
    gate = new Promise((r) => {
      release = r;
    });
  const gated = new PrismaCampaignStore(db, {
      send: async () => {
        enter();
        await gate;
      },
    }),
    delivery = gated.deliver(now);
  await entered;
  let unsubscribed = false;
  const stop = store
    .unsubscribe(unsubscribeToken(racingProfile.id, racingProfile.tokenNonce, secret))
    .then(() => {
      unsubscribed = true;
    });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(unsubscribed, false);
  release();
  await delivery;
  await stop;
  assert.equal(
    (await db.customerProfile.findUniqueOrThrow({ where: { id: racingProfile.id } })).consent,
    false,
  );
  // Durable queues retain events across a stopped marketing process.
  child.kill('SIGTERM');
  await once(child, 'exit');
  const offline = registration(`offline-${tag}@example.test`);
  await publish(offline, 'auth.user_registered');
  await start('marketing-service', 4505);
  await waitFor(
    () => db.marketingRegistration.findUnique({ where: { id: offline.payload.userId } }),
    'offline event catchup',
  );
  console.log(
    'Marketing integration passed: clean migrations, real RabbitMQ projection/replay, consent-only purchase data, legacy-safe opt-in, atomic rollback, SQL win-back intervals, concurrent scheduling/delivery, SMTP capture, global weekly cap, bounded retry, fresh-purchase cancellation, signed/Origin-protected idempotent unsubscribe, no stale resubscribe, in-flight opt-out serialization and stopped-service catchup.',
  );
} finally {
  for (const child of children)
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), new Promise((r) => setTimeout(r, 3000))]);
    }
  smtp?.onModuleDestroy();
  await db?.$disconnect();
  if (channel) {
    for (const q of ['marketing.user_registered', 'marketing.order_completed', 'marketing.rpc'])
      for (const suffix of ['', '.retry', '.dlq'])
        await channel.deleteQueue(namespace + '.' + q + suffix).catch(() => {});
    await channel.deleteExchange(namespace + '.events').catch(() => {});
    await channel.deleteExchange(namespace + '.events.dlx').catch(() => {});
    await channel.close().catch(() => {});
  }
  await connection?.close().catch(() => {});
  command('docker', [...compose, 'dropdb', '-U', 'tea_bootstrap', '--if-exists', name]);
}
