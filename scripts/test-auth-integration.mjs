import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const authDirectory = path.join(root, 'apps/auth-service');
const requireAuth = createRequire(path.join(authDirectory, 'package.json'));
const { PrismaClient } = requireAuth('./generated/prisma');
const argon = requireAuth('argon2');
const amqp = requireAuth('amqplib');
const { JwtService } = requireAuth('@nestjs/jwt');
const dbUrl = 'postgresql://auth:tea_dev_auth@localhost:5433/auth_stage1_test';
const secret = randomBytes(48).toString('hex');
const namespace = `auth-test-${randomUUID()}`;
const rpcQueue = `${namespace}.rpc`;
const environment = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  JWT_ACCESS_SECRET: secret,
  DATABASE_URL: dbUrl,
  AUTH_RPC_QUEUE: rpcQueue,
  EVENTS_NAMESPACE: namespace,
  RABBITMQ_URL: 'amqp://tea:tea_dev@localhost:5672',
  CORS_ORIGIN: 'http://localhost:3000',
};
const compose = ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres'];
function command(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Integration setup command failed: ${command}`);
  return result.stdout.trim();
}
const exists = command('docker', [
  ...compose,
  'psql',
  '-U',
  'tea_bootstrap',
  '-d',
  'postgres',
  '-tAc',
  "SELECT 1 FROM pg_database WHERE datname = 'auth_stage1_test'",
]);
if (exists !== '1')
  command('docker', [
    ...compose,
    'createdb',
    '-U',
    'tea_bootstrap',
    '-O',
    'auth',
    'auth_stage1_test',
  ]);
command(
  'pnpm',
  ['--filter', '@tea/auth-service', 'exec', 'prisma', 'migrate', 'deploy'],
  environment,
);
const db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const children = [];
const users = [];
let eventBus;
let broker;
let channel;
function start(name, port) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'apps', name),
    env: { ...environment, PORT: String(port) },
    stdio: 'ignore',
  });
  children.push(child);
  return child;
}
async function ready(port) {
  for (let count = 0; count < 100; count++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) })).ok)
        return;
    } catch {
      /* Wait for the owned process to bind. */
    }
    if (children.some((child) => child.exitCode !== null))
      throw new Error('An integration process exited during startup');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Integration startup timed out');
}
const base = 'http://127.0.0.1:4100';
function cookies(response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}
function tokenHash(cookie) {
  return createHash('sha256')
    .update(cookie.match(/tea_refresh=([^;]+)/)[1])
    .digest('hex');
}
async function api(
  route,
  { method = 'GET', input, cookie = '', origin = environment.CORS_ORIGIN } = {},
) {
  return fetch(`${base}/api/v1${route}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin,
      cookie,
      'x-correlation-id': 'auth-integration',
    },
    body: input === undefined ? undefined : JSON.stringify(input),
    signal: AbortSignal.timeout(10000),
  });
}
async function status(response, expected) {
  assert.equal(
    response.status,
    expected,
    `Unexpected HTTP status: expected ${expected}, got ${response.status}`,
  );
  return response;
}
try {
  start('auth-service', 4101);
  await ready(4101);
  start('gateway', 4100);
  await ready(4100);
  const email = `buyer-${randomUUID()}@example.test`;
  const password = randomBytes(20).toString('base64url');
  const registration = {
    email: email.toUpperCase(),
    password,
    firstName: 'Tea',
    lastName: 'Buyer',
  };
  await status(
    await api('/auth/register', { method: 'POST', input: { ...registration, role: 'ADMIN' } }),
    400,
  );
  await status(
    await api('/auth/register', {
      method: 'POST',
      input: registration,
      origin: 'https://untrusted.example',
    }),
    403,
  );
  const registered = await status(
    await api('/auth/register', { method: 'POST', input: registration }),
    201,
  );
  const user = await registered.json();
  users.push(user.id);
  assert.equal(user.email, email);
  assert.equal(user.role, 'CUSTOMER');
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.accessToken, undefined);
  const original = cookies(registered);
  const headers = registered.headers.getSetCookie().join(';');
  assert.match(headers, /HttpOnly/i);
  assert.match(headers, /SameSite=Lax/i);
  assert.match(headers, /Path=\/api\/v1\/auth/);
  assert.equal(registered.headers.get('cache-control'), 'no-store');
  const saved = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.match(saved.passwordHash, /^\$argon2id\$/);
  assert.equal(saved.marketingConsentAt, null);
  const session = await db.refreshToken.findUnique({ where: { tokenHash: tokenHash(original) } });
  assert.ok(session);
  assert.notEqual(session.tokenHash, original.match(/tea_refresh=([^;]+)/)[1]);
  assert.equal(
    await db.outbox.count({ where: { payload: { path: ['payload', 'userId'], equals: user.id } } }),
    1,
  );
  await status(await api('/auth/register', { method: 'POST', input: registration }), 409);
  await status(await api('/auth/me'), 401);
  const me = await status(await api('/auth/me', { cookie: original }), 200);
  assert.equal((await me.json()).id, user.id);
  const denied = await status(await api('/admin/auth/me', { cookie: original }), 403);
  const error = await denied.json();
  assert.equal(error.code, 'FORBIDDEN');
  assert.equal(error.correlationId, 'auth-integration');
  const jwt = new JwtService();
  const forged = jwt.sign(
    { sub: user.id, email, role: 'ADMIN' },
    { secret: 'wrong-secret', expiresIn: '15m', issuer: 'tea-auth', audience: 'tea-gateway' },
  );
  await status(await api('/admin/auth/me', { cookie: `tea_access=${forged}` }), 401);
  const expired = jwt.sign(
    { sub: user.id, email, role: 'CUSTOMER' },
    { secret, expiresIn: -1, issuer: 'tea-auth', audience: 'tea-gateway' },
  );
  await status(await api('/auth/me', { cookie: `tea_access=${expired}` }), 401);
  await status(
    await api('/auth/login', { method: 'POST', input: { email, password: 'wrong-password' } }),
    401,
  );
  const refreshed = await status(
    await api('/auth/refresh', { method: 'POST', cookie: original }),
    200,
  );
  const rotated = cookies(refreshed);
  assert.notEqual(tokenHash(rotated), tokenHash(original));
  await status(await api('/auth/refresh', { method: 'POST', cookie: original }), 401);
  // Replaying an ancestor must commit family revocation, not roll it back with an exception.
  await status(await api('/auth/refresh', { method: 'POST', cookie: rotated }), 401);
  const loggedIn = await status(
    await api('/auth/login', { method: 'POST', input: { email, password } }),
    200,
  );
  const loginCookies = cookies(loggedIn);
  const loggedOut = await status(
    await api('/auth/logout', { method: 'POST', cookie: loginCookies }),
    200,
  );
  assert.match(loggedOut.headers.getSetCookie().join(';'), /Expires=Thu, 01 Jan 1970/i);
  await status(await api('/auth/refresh', { method: 'POST', cookie: loginCookies }), 401);
  const raceLogin = await status(
    await api('/auth/login', { method: 'POST', input: { email, password } }),
    200,
  );
  const raceCookies = cookies(raceLogin);
  const racing = await Promise.all([
    api('/auth/refresh', { method: 'POST', cookie: raceCookies }),
    api('/auth/refresh', { method: 'POST', cookie: raceCookies }),
  ]);
  assert.deepEqual(racing.map((response) => response.status).sort(), [200, 401]);
  const winner = racing.find((response) => response.status === 200);
  await status(await api('/auth/refresh', { method: 'POST', cookie: cookies(winner) }), 401);
  const adminEmail = `admin-${randomUUID()}@example.test`;
  const admin = await db.user.create({
    data: {
      email: adminEmail,
      passwordHash: await argon.hash(password),
      firstName: 'Test',
      lastName: 'Admin',
      role: 'ADMIN',
    },
  });
  users.push(admin.id);
  const adminLogin = await status(
    await api('/auth/login', { method: 'POST', input: { email: adminEmail, password } }),
    200,
  );
  await status(await api('/admin/auth/me', { cookie: cookies(adminLogin) }), 200);
  // Persisted session expiry is enforced even when a cookie is otherwise well formed.
  const expiryLogin = await status(
    await api('/auth/login', { method: 'POST', input: { email, password } }),
    200,
  );
  const expiryCookie = cookies(expiryLogin);
  await db.refreshToken.update({
    where: { tokenHash: tokenHash(expiryCookie) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await status(await api('/auth/refresh', { method: 'POST', cookie: expiryCookie }), 401);
  // Check durable delivery using isolated broker topology, leaving the real marketing queue untouched.
  Object.assign(process.env, environment);
  const { OutboxPublisher } = requireAuth('./dist/shared/outbox/outbox-publisher.js');
  const { RabbitEventBus } = requireAuth('./dist/shared/outbox/rabbit-event-bus.js');
  const { PrismaAuthStore } = requireAuth(
    './dist/modules/auth/infrastructure/prisma-auth-store.js',
  );
  const store = new PrismaAuthStore(db);
  const registeredEvent = await db.outbox.findFirstOrThrow({
    where: { payload: { path: ['payload', 'userId'], equals: user.id } },
  });
  const invalidEvent = {
    eventId: registeredEvent.id,
    name: 'UserRegistered',
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: 'rollback-test',
    payload: {
      userId: randomUUID(),
      email: `rollback-${randomUUID()}@example.test`,
      firstName: 'Test',
      lastName: 'Rollback',
      marketingConsent: false,
    },
  };
  // A duplicate outbox ID fails after the user/session inserts; the entire transaction must roll back.
  await assert.rejects(() =>
    store.register(
      { ...invalidEvent.payload, passwordHash: 'unused' },
      {
        tokenHash: 'a'.repeat(64),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 1000),
        context: { correlationId: 'rollback-test' },
      },
      invalidEvent,
    ),
  );
  assert.equal(await db.user.count({ where: { id: invalidEvent.payload.userId } }), 0);
  assert.equal(await db.refreshToken.count({ where: { userId: invalidEvent.payload.userId } }), 0);
  eventBus = new RabbitEventBus();
  const publisher = new OutboxPublisher(db, eventBus);
  await publisher.flush();
  await publisher.flush();
  broker = await amqp.connect(environment.RABBITMQ_URL);
  channel = await broker.createChannel();
  const queue = `${namespace}.marketing.user_registered`;
  const message = await channel.get(queue, { noAck: true });
  assert.ok(message);
  assert.equal(JSON.parse(message.content.toString()).payload.userId, user.id);
  assert.equal(await channel.get(queue, { noAck: true }), false);
  const event = await db.outbox.findFirstOrThrow({
    where: { payload: { path: ['payload', 'userId'], equals: user.id } },
  });
  assert.ok(event.publishedAt);
  // No registered handler can expose an admin endpoint without the global role guard.
  let limited = false;
  for (let i = 0; i < 35; i++) {
    if ((await api('/auth/me')).status === 429) {
      limited = true;
      break;
    }
  }
  assert.equal(limited, true);
  console.log(
    'Auth integration passed: PostgreSQL + RabbitMQ + HTTP, RBAC, CSRF, expiry, refresh replay/concurrency, logout, Argon2, Outbox and rate limiting.',
  );
} finally {
  for (const child of children) child.kill('SIGTERM');
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode === null)
        await Promise.race([
          once(child, 'exit'),
          new Promise((resolve) =>
            setTimeout(() => {
              child.kill('SIGKILL');
              resolve();
            }, 5000),
          ),
        ]);
    }),
  );
  await eventBus?.onModuleDestroy();
  if (channel) {
    await channel.deleteQueue(`${namespace}.marketing.user_registered`);
    await channel.deleteQueue(`${namespace}.marketing.user_registered.dlq`);
    await channel.deleteQueue(rpcQueue);
    await channel.deleteExchange(`${namespace}.events`);
    await channel.deleteExchange(`${namespace}.events.dlx`);
    await channel.close();
  }
  await broker?.close();
  for (const id of users) {
    await db.outbox.deleteMany({ where: { payload: { path: ['payload', 'userId'], equals: id } } });
    await db.user.deleteMany({ where: { id } });
  }
  await db.$disconnect();
}
