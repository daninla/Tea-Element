import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, URLSearchParams } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const catalogDirectory = path.join(root, 'apps/catalog-service');
const requireCatalog = createRequire(path.join(catalogDirectory, 'package.json'));
const { PrismaClient } = requireCatalog('./generated/prisma');
const amqp = requireCatalog('amqplib');
const queue = `catalog-test-${randomUUID()}.rpc`;
const databaseUrl = 'postgresql://catalog:tea_dev_catalog@localhost:5433/catalog_stage2_test';
const env = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: databaseUrl,
  JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
  CATALOG_RPC_QUEUE: queue,
  RABBITMQ_URL: 'amqp://tea:tea_dev@localhost:5672',
};
function command(binary, args, environment = process.env) {
  const result = spawnSync(binary, args, { cwd: root, env: environment, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Catalog integration setup failed: ${binary}`);
  return result.stdout.trim();
}
const compose = ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres'];
if (
  command('docker', [
    ...compose,
    'psql',
    '-U',
    'tea_bootstrap',
    '-d',
    'postgres',
    '-tAc',
    "SELECT 1 FROM pg_database WHERE datname = 'catalog_stage2_test'",
  ]) !== '1'
)
  command('docker', [
    ...compose,
    'createdb',
    '-U',
    'tea_bootstrap',
    '-O',
    'catalog',
    'catalog_stage2_test',
  ]);
command('pnpm', ['--filter', '@tea/catalog-service', 'exec', 'prisma', 'migrate', 'deploy'], env);
command('pnpm', ['--filter', '@tea/catalog-service', 'db:seed'], env);
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const children = [];
const promotionIds = [];
const variantsToRestore = [];
const stockToRestore = [];
const productsToRestore = [];
const categoriesToRestore = [];
function start(name, port) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'apps', name),
    env: { ...env, PORT: String(port) },
    stdio: 'ignore',
  });
  children.push(child);
}
async function ready(port) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) })).ok)
        return;
    } catch {
      /* Wait for owned listeners. */
    }
    if (children.some((child) => child.exitCode !== null))
      throw new Error('Catalog integration child exited');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Catalog integration startup timed out');
}
async function response(route, expected = 200) {
  const result = await fetch(`http://127.0.0.1:4200/api/v1${route}`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(result.status, expected, `${route}: expected ${expected}, got ${result.status}`);
  return result.json();
}
async function list(parameters = {}) {
  return response(`/products?${new URLSearchParams(parameters)}`);
}
try {
  assert.equal(await db.product.count(), 16);
  assert.equal(await db.productVariant.count(), 40);
  const tie = await db.product.findUniqueOrThrow({
    where: { slug: 'tie-guan-yin' },
    include: { variants: { orderBy: { weightGrams: 'asc' } }, inventory: true },
  });
  const small = tie.variants[0];
  variantsToRestore.push({ id: small.id, price: small.price, isActive: small.isActive });
  stockToRestore.push({
    productId: tie.id,
    stockGrams: tie.inventory.stockGrams,
    reservedGrams: tie.inventory.reservedGrams,
  });
  await db.productVariant.update({ where: { id: small.id }, data: { price: 10001 } });
  await db.inventory.update({
    where: { productId: tie.id },
    data: { stockGrams: 120, reservedGrams: 80 },
  });
  // Re-seeding must not reset prices or reservations made after the initial fixture import.
  command('pnpm', ['--filter', '@tea/catalog-service', 'db:seed'], env);
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: small.id } })).price,
    10001,
  );
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: tie.id } })).reservedGrams,
    80,
  );
  assert.equal(await db.product.count(), 16);
  assert.equal(await db.promotion.count(), 2);
  start('catalog-service', 4202);
  await ready(4202);
  start('gateway', 4200);
  await ready(4200);
  const categories = await response('/categories');
  assert.equal(categories.length, 9);
  assert.equal(
    categories.reduce((sum, c) => sum + c.productsCount, 0),
    16,
  );
  const all = await list({ pageSize: '48' });
  assert.equal(all.total, 12);
  assert.equal(all.items.length, 12);
  assert.equal(all.totalPages, 1);
  const equipment = await list({ section: 'EQUIPMENT', pageSize: '48' });
  assert.equal(equipment.total, 4);
  assert.ok(
    equipment.items.every(
      (p) =>
        p.category.section === 'EQUIPMENT' &&
        p.brewingGuide === null &&
        p.variants.every((v) => v.weightGrams === null),
    ),
  );
  assert.equal((await list({ section: 'ALL', pageSize: '48' })).total, 16);
  assert.equal((await list({ category: 'accessories' })).total, 2);
  assert.equal((await list({ section: 'ALL', q: 'гайвань' })).items[0].slug, 'porcelain-gaiwan');
  const equipmentProduct = await db.product.findUniqueOrThrow({
    where: { slug: 'bamboo-tea-tongs' },
    include: { variants: true },
  });
  await db.inventory.update({
    where: { productId: equipmentProduct.id },
    data: { reservedPieces: 1 },
  });
  assert.equal(
    (await list({ section: 'EQUIPMENT', inStock: 'false' })).items[0].slug,
    'bamboo-tea-tongs',
  );
  assert.equal((await response('/products/bamboo-tea-tongs')).inStock, false);
  command('pnpm', ['--filter', '@tea/catalog-service', 'db:seed'], env);
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: equipmentProduct.id } }))
      .reservedPieces,
    1,
  );
  await db.inventory.update({
    where: { productId: equipmentProduct.id },
    data: { reservedPieces: 0 },
  });
  const detail = await response('/products/tie-guan-yin');
  assert.equal(detail.variants[0].originalPrice, 10001);
  assert.equal(detail.variants[0].price, 9001);
  assert.deepEqual(
    detail.variants.map((v) => v.inStock),
    [true, false, false],
  );
  assert.equal(detail.minPrice, 9001);
  assert.equal(detail.inventory, undefined);
  assert.equal(detail.salesCount, undefined);
  const oolong = await list({ category: 'oolong' });
  assert.equal(oolong.total, 3);
  assert.ok(oolong.items.every((p) => p.category.slug === 'oolong'));
  assert.ok((await list({ q: 'ПУЕР' })).total >= 2);
  assert.equal((await list({ q: '铁观音' })).total, 1);
  assert.equal((await list({ q: '%' })).total, 0);
  assert.equal((await list({ q: "' OR 1=1 --" })).total, 0);
  assert.ok((await list({ origin: 'фуцзянь' })).items.every((p) => p.origin === 'Фуцзянь'));
  assert.equal((await list({ minPrice: '9001', maxPrice: '9001' })).items[0].slug, 'tie-guan-yin');
  const sales = await list({ onSale: 'true' });
  assert.ok(sales.items.every((p) => p.onSale));
  const regular = await list({ onSale: 'false' });
  assert.ok(regular.items.every((p) => !p.onSale));
  const available = await list({ inStock: 'true' });
  assert.equal(available.total, 11);
  const unavailable = await list({ inStock: 'false' });
  assert.equal(unavailable.items[0].slug, 'ju-hua');
  assert.deepEqual(
    (await response('/products/gaba-oolong')).variants.map((v) => v.inStock),
    [true, false, false],
  );
  for (const sort of ['price_asc', 'price_desc']) {
    const ordered = (await list({ sort, pageSize: '48' })).items.map((p) => p.minPrice);
    assert.deepEqual(
      ordered,
      [...ordered].sort((a, b) => (sort === 'price_asc' ? a - b : b - a)),
    );
  }
  const one = await list({ page: '1', pageSize: '5' });
  const two = await list({ page: '2', pageSize: '5' });
  assert.equal(one.totalPages, 3);
  assert.equal(new Set([...one.items, ...two.items].map((p) => p.id)).size, 10);
  const beyond = await list({ page: '10000', pageSize: '5' });
  assert.equal(beyond.total, 12);
  assert.deepEqual(beyond.items, []);
  for (const invalid of [
    'page=0',
    'pageSize=49',
    'sort=sql',
    'onSale=yes',
    'minPrice=1.5',
    'minPrice=100&maxPrice=50',
    'q=x&q=y',
    'ignored=1',
    'section=INVALID',
    'section=TEA&section=EQUIPMENT',
  ])
    await response(`/products?${invalid}`, 400);
  await response('/products/nonexistent-tea', 404);
  productsToRestore.push({ id: tie.id, isActive: tie.isActive });
  await db.product.update({ where: { id: tie.id }, data: { isActive: false } });
  await response('/products/tie-guan-yin', 404);
  assert.equal((await list({ category: 'oolong' })).total, 2);
  await db.product.update({ where: { id: tie.id }, data: { isActive: true } });
  await db.productVariant.update({ where: { id: small.id }, data: { isActive: false } });
  assert.equal((await response('/products/tie-guan-yin')).minPrice, 19800);
  await db.productVariant.update({ where: { id: small.id }, data: { isActive: true } });
  const category = await db.category.findUniqueOrThrow({ where: { id: tie.categoryId } });
  categoriesToRestore.push({ id: category.id, isActive: category.isActive });
  await db.category.update({ where: { id: category.id }, data: { isActive: false } });
  await response('/products/tie-guan-yin', 404);
  assert.equal((await list({ category: 'oolong' })).total, 0);
  await db.category.update({ where: { id: category.id }, data: { isActive: true } });
  // A live fixed discount beats the category discount without stacking. Expired/disabled promotions do nothing.
  const promo = await db.promotion.create({
    data: {
      name: 'Isolated pricing test',
      type: 'FIXED',
      value: 2000,
      startsAt: new Date(Date.now() - 60000),
      endsAt: new Date(Date.now() + 3600000),
      targets: { create: { productId: tie.id } },
    },
  });
  promotionIds.push(promo.id);
  assert.equal((await response('/products/tie-guan-yin')).minPrice, 8001);
  assert.equal((await list({ minPrice: '8001', maxPrice: '8001' })).items[0].slug, 'tie-guan-yin');
  await db.promotion.update({
    where: { id: promo.id },
    data: { endsAt: new Date(Date.now() - 1) },
  });
  assert.equal((await response('/products/tie-guan-yin')).minPrice, 9001);
  await db.promotion.update({
    where: { id: promo.id },
    data: { endsAt: new Date(Date.now() + 3600000), isActive: false },
  });
  assert.equal((await response('/products/tie-guan-yin')).minPrice, 9001);
  console.log(
    'Catalog integration passed: clean migrations, repeatable seed, guest HTTP/RMQ access, filters, discounted price sorting, pagination, hidden rows and gram availability.',
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
  await db.promotion.deleteMany({ where: { id: { in: promotionIds } } });
  for (const { id, ...data } of variantsToRestore)
    await db.productVariant.update({ where: { id }, data });
  for (const { productId, ...data } of stockToRestore)
    await db.inventory.update({ where: { productId }, data });
  for (const { id, ...data } of productsToRestore) await db.product.update({ where: { id }, data });
  for (const { id, ...data } of categoriesToRestore)
    await db.category.update({ where: { id }, data });
  await db.$disconnect();
  const connection = await amqp.connect(env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.deleteQueue(queue);
  await channel.close();
  await connection.close();
}
