import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, URLSearchParams } from 'node:url';
import path from 'node:path';
import { rm } from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const catalogDirectory = path.join(root, 'apps/catalog-service');
const requireCatalog = createRequire(path.join(catalogDirectory, 'package.json'));
const { PrismaClient } = requireCatalog('./generated/prisma');
const amqp = requireCatalog('amqplib');
const queue = `catalog-test-${randomUUID()}.rpc`;
const databaseUrl = 'postgresql://catalog:tea_dev_catalog@localhost:5433/catalog_stage2_test';
const mediaDirectory = path.join('/tmp', 'tea-catalog-media-test-' + randomUUID());
const env = {
  CATALOG_MEDIA_DIR: mediaDirectory,
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
const inventoryFixtureIds = [];
const inventoryFixtureEvents = [];
const inventoryFixtureOrders = [];
const catalogFixtureIds = [];
const catalogCategoryIds = [];
const mediaFixtureIds = [];
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
  // Inventory commands operate only on isolated product fixtures in this test database.
  const requireGateway = createRequire(path.join(root, 'apps/gateway/package.json'));
  const { JwtService } = requireGateway('@nestjs/jwt');
  const jwt = new JwtService();
  const actor = randomUUID();
  const auth = (role = 'ADMIN') =>
    'tea_access=' +
    jwt.sign(
      { sub: actor, email: 'inventory@example.test', role },
      {
        secret: env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        issuer: 'tea-auth',
        audience: 'tea-gateway',
        expiresIn: '15m',
      },
    );
  async function admin(route, { method = 'GET', body, key, cookie = auth(), expected = 200 } = {}) {
    const response = await fetch('http://127.0.0.1:4200/api/v1' + route, {
      method,
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        cookie,
        ...(key ? { 'idempotency-key': key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    assert.equal(
      response.status,
      expected,
      `${route}: expected ${expected}, got ${response.status} (${data.code ?? ''})`,
    );
    return data;
  }
  const fixtureTag = 'inventory_' + randomUUID().replaceAll('-', '') + '%_';
  const equipmentCategory = await db.category.findFirstOrThrow({ where: { section: 'EQUIPMENT' } });
  const fixtures = [];
  for (const [categoryId, unit] of [
    [tie.categoryId, 'GRAM'],
    [equipmentCategory.id, 'PIECE'],
  ]) {
    const p = await db.product.create({
      data: {
        slug: 'inventory-' + randomUUID(),
        name: fixtureTag + ' ' + unit,
        nameOriginal: '',
        description: 'Isolated inventory fixture',
        origin: 'Test',
        categoryId,
        images: [],
        tags: [],
        inventory: {
          create:
            unit === 'GRAM'
              ? { stockGrams: 100, reservedGrams: 20 }
              : { stockPieces: 10, reservedPieces: 2 },
        },
        variants: {
          create: { weightGrams: unit === 'GRAM' ? 25 : null, price: 100, sku: randomUUID() },
        },
      },
      include: { variants: true },
    });
    inventoryFixtureIds.push(p.id);
    fixtures.push(p);
  }
  const tea = fixtures[0],
    piece = fixtures[1];
  await admin('/admin/inventory', { cookie: '', expected: 401 });
  await admin('/admin/inventory', { cookie: auth('CUSTOMER'), expected: 403 });
  const filtered = await admin('/admin/inventory?q=' + encodeURIComponent(fixtureTag));
  assert.equal(filtered.total, 2);
  const low = await admin(
    '/admin/inventory?q=' + encodeURIComponent(fixtureTag) + '&lowStock=true',
  );
  assert.equal(low.total, 1);
  assert.equal(low.items[0].productId, tea.id);
  const inventoryBeyond = await admin(
    '/admin/inventory?q=' + encodeURIComponent(fixtureTag) + '&page=10000',
  );
  assert.equal(inventoryBeyond.total, 2);
  assert.equal(inventoryBeyond.items.length, 0);
  await admin('/admin/inventory?lowStock=yes', { expected: 400 });
  await admin('/admin/inventory?page=0', { expected: 400 });
  const key = randomUUID();
  const invoice = {
    productId: tea.id,
    quantity: 25,
    purchasePriceTotal: 12345,
    supplier: 'Test supplier',
    purchasedAt: '2020-01-01T00:00:00Z',
    note: 'Isolated purchase receipt',
  };
  await admin('/admin/inventory/purchases', {
    method: 'POST',
    body: invoice,
    key,
    cookie: auth('CUSTOMER'),
    expected: 403,
  });
  await admin('/admin/inventory/purchases', {
    method: 'POST',
    body: { ...invoice, actorId: actor },
    key,
    expected: 400,
  });
  await admin('/admin/inventory/purchases', {
    method: 'POST',
    body: { ...invoice, purchasePriceTotal: 1.5 },
    key,
    expected: 400,
  });
  await admin('/admin/inventory/purchases', {
    method: 'POST',
    body: { ...invoice, purchasedAt: new Date(Date.now() + 86400000).toISOString() },
    key,
    expected: 400,
  });
  const [purchase, replay] = await Promise.all([
    admin('/admin/inventory/purchases', { method: 'POST', body: invoice, key }),
    admin('/admin/inventory/purchases', { method: 'POST', body: invoice, key }),
  ]);
  assert.deepEqual(purchase, replay);
  assert.equal(purchase.stock, 125);
  assert.equal(purchase.reserved, 20);
  assert.equal(await db.purchaseBatch.count({ where: { productId: tea.id } }), 1);
  assert.equal(await db.stockMovement.count({ where: { productId: tea.id, type: 'PURCHASE' } }), 1);
  await admin('/admin/inventory/purchases', {
    method: 'POST',
    body: { ...invoice, quantity: 26 },
    key,
    expected: 409,
  });
  const adjusted = await admin(`/admin/inventory/${tea.id}/adjust`, {
    method: 'POST',
    key: randomUUID(),
    body: {
      delta: -10,
      expectedStock: 125,
      kind: 'ADJUSTMENT',
      reason: 'Inventory count correction',
    },
  });
  assert.equal(adjusted.stock, 115);
  assert.deepEqual(
    await admin('/admin/inventory/purchases', { method: 'POST', body: invoice, key }),
    purchase,
  );
  assert.equal((await admin('/admin/inventory/' + tea.id)).stock, 115);
  await admin(`/admin/inventory/${tea.id}/adjust`, {
    method: 'POST',
    key: randomUUID(),
    body: {
      delta: -100,
      expectedStock: 115,
      kind: 'WRITE_OFF',
      reason: 'Reserved goods cannot be removed',
    },
    expected: 409,
  });
  await admin(`/admin/inventory/${tea.id}/adjust`, {
    method: 'POST',
    key: randomUUID(),
    body: { delta: -1, expectedStock: 125, kind: 'WRITE_OFF', reason: 'Stale operator view' },
    expected: 409,
  });
  await admin(`/admin/inventory/${tea.id}/adjust`, {
    method: 'POST',
    key: randomUUID(),
    body: { delta: 1, expectedStock: 115, kind: 'WRITE_OFF', reason: 'Invalid positive writeoff' },
    expected: 400,
  });
  const { PrismaInventoryStore } = requireCatalog(
    './dist/modules/inventory/infrastructure/prisma-inventory-store',
  );
  const repo = new PrismaInventoryStore(db);
  const failedKey = randomUUID();
  const broken = new PrismaInventoryStore(
    db.$extends({
      query: {
        inventoryCommand: {
          create() {
            throw new Error('injected command persistence failure');
          },
        },
      },
    }),
  );
  const before = await repo.get(tea.id);
  const batchCount = await db.purchaseBatch.count({ where: { productId: tea.id } });
  const moveCount = await db.stockMovement.count({ where: { productId: tea.id } });
  await assert.rejects(() => broken.purchase({ ...invoice, key: failedKey }, actor));
  assert.deepEqual(await repo.get(tea.id), before);
  assert.equal(await db.purchaseBatch.count({ where: { productId: tea.id } }), batchCount);
  assert.equal(await db.stockMovement.count({ where: { productId: tea.id } }), moveCount);
  assert.equal(await db.inventoryCommand.count({ where: { key: failedKey } }), 0);
  const changes = await Promise.allSettled([
    repo.adjust(
      {
        productId: tea.id,
        delta: -60,
        expectedStock: 115,
        kind: 'WRITE_OFF',
        reason: 'Competing writeoff A',
        key: randomUUID(),
      },
      actor,
    ),
    repo.adjust(
      {
        productId: tea.id,
        delta: -60,
        expectedStock: 115,
        kind: 'WRITE_OFF',
        reason: 'Competing writeoff B',
        key: randomUUID(),
      },
      actor,
    ),
  ]);
  assert.equal(changes.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await repo.get(tea.id)).stock, 55);
  const { PrismaStockStore } = requireCatalog(
    './dist/modules/stock/infrastructure/prisma-stock-store',
  );
  const event = {
    eventId: randomUUID(),
    name: 'OrderCreated',
    version: 2,
    occurredAt: new Date().toISOString(),
    correlationId: 'inventory-race',
    payload: {
      orderId: randomUUID(),
      items: [
        {
          productId: tea.id,
          variantId: tea.variants[0].id,
          stockUnit: 'GRAM',
          stockQuantity: 25,
          quantity: 1,
        },
      ],
    },
  };
  inventoryFixtureEvents.push(event.eventId);
  inventoryFixtureOrders.push(event.payload.orderId);
  const [correction] = await Promise.allSettled([
    repo.adjust(
      {
        productId: tea.id,
        delta: -30,
        expectedStock: 55,
        kind: 'ADJUSTMENT',
        reason: 'Competing with reservation',
        key: randomUUID(),
      },
      actor,
    ),
    new PrismaStockStore(db).apply(event),
  ]);
  const raced = await repo.get(tea.id);
  assert.ok(raced.stock >= raced.reserved);
  const reservation = await db.stockReservation.findUniqueOrThrow({
    where: { orderId: event.payload.orderId },
  });
  assert.equal(reservation.status, correction.status === 'fulfilled' ? 'FAILED' : 'RESERVED');
  const receivedPiece = await admin('/admin/inventory/purchases', {
    method: 'POST',
    key: randomUUID(),
    body: { ...invoice, productId: piece.id, quantity: 2, purchasePriceTotal: 0 },
  });
  assert.equal(receivedPiece.unit, 'PIECE');
  assert.equal(receivedPiece.stock, 12);
  assert.equal(receivedPiece.reserved, 2);
  for (let i = 0; i < 21; i++)
    await repo.purchase({ ...invoice, quantity: 1, key: randomUUID() }, actor);
  const pageOne = await admin(`/admin/inventory/purchases?productId=${tea.id}&page=1`),
    pageTwo = await admin(`/admin/inventory/purchases?productId=${tea.id}&page=2`);
  assert.equal(pageOne.total, 22);
  assert.equal(pageOne.items.length, 20);
  assert.equal(pageTwo.items.length, 2);
  assert.equal(new Set([...pageOne.items, ...pageTwo.items].map((x) => x.id)).size, 22);
  const journal = await admin(`/admin/inventory/movements?productId=${tea.id}`);
  assert.ok(journal.items.some((x) => x.actorId === actor && x.referenceId && x.note));
  await db.product.update({ where: { id: piece.id }, data: { isActive: false } });
  assert.equal((await admin('/admin/inventory/' + piece.id)).active, false);
  // Catalog mutations pass through the real gateway, RPC and isolated database.
  await admin('/admin/products', { cookie: auth('CUSTOMER'), expected: 403 });
  await admin('/admin/categories', { cookie: '', expected: 401 });
  await admin('/admin/products?page=0', { expected: 400 });
  const tag = 'editor-' + randomUUID();
  const catInput = {
    slug: tag,
    name: 'Editor category',
    description: 'Integration category',
    section: 'TEA',
    sortOrder: 100,
    isActive: true,
  };
  const categoryKey = randomUUID();
  const cat = await admin('/admin/categories', {
    method: 'POST',
    body: catInput,
    key: categoryKey,
  });
  catalogCategoryIds.push(cat.id);
  assert.deepEqual(
    await admin('/admin/categories', { method: 'POST', body: catInput, key: categoryKey }),
    cat,
  );
  await admin('/admin/categories', {
    method: 'POST',
    body: { ...catInput, name: 'Different' },
    key: categoryKey,
    expected: 409,
  });
  const productInput = {
    slug: tag,
    name: 'Editor integration tea',
    nameOriginal: '',
    description: 'Integration tea only',
    origin: 'Test',
    year: null,
    brewingGuide: null,
    categoryId: cat.id,
    images: [],
    tags: ['integration'],
    isActive: true,
    variants: [{ sku: tag + '-25', weightGrams: 25, price: 12345, isActive: true }],
  };
  const createKey = randomUUID();
  let edited = await admin('/admin/products', {
    method: 'POST',
    body: productInput,
    key: createKey,
  });
  catalogFixtureIds.push(edited.id);
  assert.deepEqual(
    await admin('/admin/products', { method: 'POST', body: productInput, key: createKey }),
    edited,
  );
  assert.equal(
    (await db.inventory.findUniqueOrThrow({ where: { productId: edited.id } })).stockGrams,
    0,
  );
  assert.equal((await response('/products/' + tag)).minPrice, 12345);
  assert.equal((await response('/products/' + tag)).inStock, false);
  const cleanInput = (x) => {
    const { id, revision, category, ...input } = x;
    assert.ok(id && Number.isInteger(revision) && category);
    return input;
  };
  const updateInput = {
    ...cleanInput(edited),
    variants: edited.variants.map((v) => ({ ...v, price: 23456 })),
  };
  const update = { input: updateInput, expectedRevision: edited.revision },
    updateKey = randomUUID();
  edited = await admin('/admin/products/' + edited.id, {
    method: 'PATCH',
    body: update,
    key: updateKey,
  });
  assert.equal(edited.revision, 1);
  assert.equal((await response('/products/' + tag)).minPrice, 23456);
  assert.deepEqual(
    await admin('/admin/products/' + edited.id, { method: 'PATCH', body: update, key: updateKey }),
    edited,
  );
  await admin('/admin/products/' + edited.id, {
    method: 'PATCH',
    body: update,
    key: randomUUID(),
    expected: 409,
  });
  await admin('/admin/products/' + edited.id, {
    method: 'PATCH',
    body: {
      input: {
        ...cleanInput(edited),
        variants: edited.variants.map((v) => ({ ...v, weightGrams: 50 })),
      },
      expectedRevision: edited.revision,
    },
    key: randomUUID(),
    expected: 409,
  });
  await admin('/admin/products', {
    method: 'POST',
    body: {
      ...productInput,
      slug: tag + '-bad',
      variants: [{ ...productInput.variants[0], sku: tag + '-bad', price: 0 }],
    },
    key: randomUUID(),
    expected: 400,
  });
  await admin('/admin/products', {
    method: 'POST',
    body: { ...productInput, actorId: actor },
    key: randomUUID(),
    expected: 400,
  });
  const { PrismaCatalogAdminStore } = requireCatalog(
    './dist/modules/catalog-admin/infrastructure/prisma-catalog-admin-store',
  );
  const editor = new PrismaCatalogAdminStore(db);
  const brokenEditor = new PrismaCatalogAdminStore(
    db.$extends({
      query: {
        catalogCommand: {
          create() {
            throw new Error('injected catalog audit failure');
          },
        },
      },
    }),
  );
  const beforeEdit = await editor.read({ kind: 'PRODUCT', id: edited.id });
  await assert.rejects(() =>
    brokenEditor.write(
      {
        kind: 'UPDATE_PRODUCT',
        id: edited.id,
        expectedRevision: edited.revision,
        input: { ...cleanInput(edited), name: 'Should rollback' },
        key: randomUUID(),
      },
      actor,
    ),
  );
  assert.deepEqual(await editor.read({ kind: 'PRODUCT', id: edited.id }), beforeEdit);
  const races = await Promise.allSettled(
    [1, 2].map((n) =>
      editor.write(
        {
          kind: 'UPDATE_PRODUCT',
          id: edited.id,
          expectedRevision: edited.revision,
          input: { ...cleanInput(edited), name: 'Concurrent editor ' + n },
          key: randomUUID(),
        },
        actor,
      ),
    ),
  );
  assert.equal(races.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    races.filter((x) => x.status === 'rejected' && x.reason.code === 'STALE_CATALOG').length,
    1,
  );
  edited = await admin('/admin/products/' + edited.id);
  const audit = await admin('/admin/catalog/' + edited.id + '/audit');
  assert.equal(audit.total, 3);
  assert.ok(audit.items.every((x) => x.actorId === actor && !('result' in x) && !('key' in x)));
  await admin('/admin/inventory/purchases', {
    method: 'POST',
    key: randomUUID(),
    body: { ...invoice, productId: edited.id, quantity: 50, purchasePriceTotal: 1000 },
  });
  assert.equal((await response('/products/' + tag)).inStock, true);
  // A new portion preserves the old ID, SKU and reservation weight.
  edited = await editor.write(
    {
      kind: 'UPDATE_PRODUCT',
      id: edited.id,
      expectedRevision: edited.revision,
      input: {
        ...cleanInput(edited),
        variants: [
          ...edited.variants,
          { sku: tag + '-50', weightGrams: 50, price: 35000, isActive: true },
        ],
      },
      key: randomUUID(),
    },
    actor,
  );
  assert.equal(edited.variants.length, 2);
  const pieceCat = await admin('/admin/categories', {
    method: 'POST',
    key: randomUUID(),
    body: { ...catInput, slug: tag + '-pieces', name: 'Editor pieces', section: 'EQUIPMENT' },
  });
  catalogCategoryIds.push(pieceCat.id);
  await admin('/admin/products/' + edited.id, {
    method: 'PATCH',
    key: randomUUID(),
    body: {
      expectedRevision: edited.revision,
      input: { ...cleanInput(edited), categoryId: pieceCat.id },
    },
    expected: 409,
  });
  const newPiece = await admin('/admin/products', {
    method: 'POST',
    key: randomUUID(),
    body: {
      ...productInput,
      slug: tag + '-cup',
      categoryId: pieceCat.id,
      variants: [{ sku: tag + '-cup', weightGrams: null, price: 45678, isActive: true }],
    },
  });
  catalogFixtureIds.push(newPiece.id);
  assert.equal((await response('/products/' + tag + '-cup')).variants[0].weightGrams, null);
  // Decode actual bytes, strip metadata, publish opaque WebP and reject active content.
  const sharp = requireCatalog('sharp');
  const png = await sharp({ create: { width: 12, height: 8, channels: 3, background: '#336633' } })
    .png()
    .toBuffer();
  async function uploadImage(bytes, type = 'image/png', cookie = auth(), expected = 200) {
    const form = new globalThis.FormData();
    form.set('file', new globalThis.Blob([bytes], { type }), 'image.png');
    const r = await fetch('http://127.0.0.1:4200/api/v1/admin/media', {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:3000' },
      body: form,
    });
    const data = await r.json();
    assert.equal(r.status, expected, JSON.stringify(data));
    return data;
  }
  const asset = await uploadImage(png);
  mediaFixtureIds.push(asset.id);
  assert.equal(asset.width, 12);
  assert.equal(asset.height, 8);
  const publicMedia = await fetch('http://127.0.0.1:4200/api/v1' + asset.path);
  assert.equal(publicMedia.status, 200);
  assert.equal(publicMedia.headers.get('content-type'), 'image/webp');
  assert.match(publicMedia.headers.get('cache-control'), /immutable/);
  const bytes = Buffer.from(await publicMedia.arrayBuffer());
  assert.equal((await sharp(bytes).metadata()).format, 'webp');
  await uploadImage(
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    'image/png',
    auth(),
    400,
  );
  await uploadImage(png, 'image/png', auth('CUSTOMER'), 403);
  await uploadImage(Buffer.alloc(5242881), 'image/png', auth(), 413);
  await response('/media/' + randomUUID() + '.webp', 404);
  edited = await editor.write(
    {
      kind: 'UPDATE_PRODUCT',
      id: edited.id,
      expectedRevision: edited.revision,
      input: { ...cleanInput(edited), images: [asset.path] },
      key: randomUUID(),
    },
    actor,
  );
  assert.deepEqual((await response('/products/' + tag)).images, [asset.path]);
  await assert.rejects(
    () =>
      editor.write(
        {
          kind: 'UPDATE_PRODUCT',
          id: edited.id,
          expectedRevision: edited.revision,
          input: { ...cleanInput(edited), images: ['/media/' + randomUUID() + '.webp'] },
          key: randomUUID(),
        },
        actor,
      ),
    (x) => x.code === 'INVALID_INPUT',
  );
  await admin('/admin/categories/' + cat.id, {
    method: 'PATCH',
    key: randomUUID(),
    body: { expectedRevision: cat.revision, input: { ...catInput, isActive: false } },
  });
  await response('/products/' + tag, 404);
  await admin('/admin/products/' + edited.id, {
    method: 'PATCH',
    key: randomUUID(),
    body: { expectedRevision: edited.revision, input: cleanInput(edited) },
    expected: 400,
  });
  edited = await admin('/admin/products/' + edited.id, {
    method: 'PATCH',
    key: randomUUID(),
    body: { expectedRevision: edited.revision, input: { ...cleanInput(edited), isActive: false } },
  });
  assert.equal(edited.isActive, false);
  assert.ok(await db.inventory.findUnique({ where: { productId: edited.id } }));
  const categoryAudit = await admin('/admin/catalog/' + cat.id + '/audit');
  assert.equal(categoryAudit.total, 2);
  assert.equal((await admin('/admin/products?q=' + tag)).total, 2);
  // Promotions use the same transactional audit and command replay boundary.
  const saleInput = {
    name: 'Sale ' + tag + '%_',
    type: 'PERCENT',
    value: 17,
    startsAt: '2020-01-01T00:00:00.000Z',
    endsAt: '2099-01-01T00:00:00.000Z',
    isActive: true,
    targets: [{ kind: 'PRODUCT', id: newPiece.id }],
  };
  await admin('/admin/promotions', { cookie: auth('CUSTOMER'), expected: 403 });
  await admin('/admin/promotions', {
    method: 'POST',
    body: saleInput,
    key: randomUUID(),
    cookie: auth('CUSTOMER'),
    expected: 403,
  });
  const saleKey = randomUUID();
  let sale = await admin('/admin/promotions', { method: 'POST', body: saleInput, key: saleKey });
  promotionIds.push(sale.id);
  const originalSale = globalThis.structuredClone(sale);
  assert.equal((await response('/products/' + tag + '-cup')).minPrice, 37913);
  const freshQuote = await new PrismaStockStore(db).quote([
    { variantId: newPiece.variants[0].id, quantity: 2 },
  ]);
  assert.equal(freshQuote.items[0].unitPrice, 37913);
  assert.equal(freshQuote.total, 75826);
  assert.deepEqual(
    await admin('/admin/promotions', { method: 'POST', body: saleInput, key: saleKey }),
    sale,
  );
  await admin('/admin/promotions', {
    method: 'POST',
    body: { ...saleInput, value: 18 },
    key: saleKey,
    expected: 409,
  });
  for (const input of [
    { ...saleInput, value: 101 },
    { ...saleInput, value: 1.5 },
    { ...saleInput, endsAt: saleInput.startsAt },
    { ...saleInput, targets: [] },
    { ...saleInput, targets: [{ kind: 'PRODUCT', id: randomUUID() }] },
    { ...saleInput, targets: [...saleInput.targets, ...saleInput.targets] },
  ])
    await admin('/admin/promotions', {
      method: 'POST',
      body: input,
      key: randomUUID(),
      expected: 400,
    });
  const saleFields = (x) => ({
    name: x.name,
    type: x.type,
    value: x.value,
    startsAt: x.startsAt,
    endsAt: x.endsAt,
    isActive: x.isActive,
    targets: x.targets.map(({ kind, id }) => ({ kind, id })),
  });
  const saleUpdate = {
    expectedRevision: sale.revision,
    input: { ...saleFields(sale), type: 'FIXED', value: 10000 },
  };
  sale = await admin('/admin/promotions/' + sale.id, {
    method: 'PATCH',
    body: saleUpdate,
    key: randomUUID(),
  });
  assert.equal(sale.revision, 1);
  assert.equal((await response('/products/' + tag + '-cup')).minPrice, 35678);
  await admin('/admin/promotions/' + sale.id, {
    method: 'PATCH',
    body: saleUpdate,
    key: randomUUID(),
    expected: 409,
  });
  let categorySale = await admin('/admin/promotions', {
    method: 'POST',
    key: randomUUID(),
    body: {
      ...saleInput,
      name: 'Category ' + tag,
      type: 'PERCENT',
      value: 20,
      targets: [{ kind: 'CATEGORY', id: pieceCat.id }],
    },
  });
  promotionIds.push(categorySale.id);
  assert.equal((await response('/products/' + tag + '-cup')).minPrice, 35678); // Never stack category and product discounts.
  sale = await admin('/admin/promotions/' + sale.id, {
    method: 'PATCH',
    key: randomUUID(),
    body: { expectedRevision: sale.revision, input: { ...saleFields(sale), isActive: false } },
  });
  assert.equal((await response('/products/' + tag + '-cup')).minPrice, 36543);
  categorySale = await admin('/admin/promotions/' + categorySale.id, {
    method: 'PATCH',
    key: randomUUID(),
    body: {
      expectedRevision: categorySale.revision,
      input: { ...saleFields(categorySale), startsAt: '2098-01-01T00:00:00.000Z' },
    },
  });
  assert.equal((await response('/products/' + tag + '-cup')).minPrice, 45678);
  categorySale = await admin('/admin/promotions/' + categorySale.id, {
    method: 'PATCH',
    key: randomUUID(),
    body: {
      expectedRevision: categorySale.revision,
      input: {
        ...saleFields(categorySale),
        startsAt: '2020-01-01T00:00:00.000Z',
        endsAt: '2021-01-01T00:00:00.000Z',
      },
    },
  });
  assert.equal((await response('/products/' + tag + '-cup')).minPrice, 45678);
  const beforeSale = await editor.read({ kind: 'PROMOTION', id: sale.id });
  await assert.rejects(() =>
    brokenEditor.write(
      {
        kind: 'UPDATE_PROMOTION',
        id: sale.id,
        expectedRevision: sale.revision,
        input: { ...saleFields(sale), targets: [{ kind: 'CATEGORY', id: pieceCat.id }] },
        key: randomUUID(),
      },
      actor,
    ),
  );
  assert.deepEqual(await editor.read({ kind: 'PROMOTION', id: sale.id }), beforeSale);
  const promotionRaces = await Promise.allSettled(
    [1, 2].map((n) =>
      editor.write(
        {
          kind: 'UPDATE_PROMOTION',
          id: sale.id,
          expectedRevision: sale.revision,
          input: { ...saleFields(sale), name: sale.name + ' ' + n },
          key: randomUUID(),
        },
        actor,
      ),
    ),
  );
  assert.equal(promotionRaces.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    promotionRaces.filter((x) => x.status === 'rejected' && x.reason.code === 'STALE_CATALOG')
      .length,
    1,
  );
  assert.deepEqual(
    await admin('/admin/promotions', { method: 'POST', body: saleInput, key: saleKey }),
    originalSale,
  );
  assert.equal((await admin('/admin/promotions?q=' + encodeURIComponent(tag + '%_'))).total, 1);
  const saleAudit = await admin('/admin/catalog/' + sale.id + '/audit');
  assert.equal(saleAudit.total, 4);
  assert.equal((await admin('/admin/promotions?page=999')).items.length, 0);
  assert.equal((await admin('/admin/promotions/' + sale.id)).id, sale.id);
  console.log(
    'Promotion integration passed: RBAC, percent/fixed fresh catalog and quotes, best non-stacked discount, time windows, deactivation, strict targets, stable replay, revision races, audit rollback, literal search and pagination.',
  );
  console.log(
    'Catalog editor integration passed: ADMIN access, exact replay/conflicts, revisions/races, immutable portions and units, audit rollback, current public prices/stock, category hiding, piece products, actual image conversion/public bytes, SVG rejection, upload bounds and audit.',
  );
  console.log(
    'Catalog integration passed: clean migrations, repeatable seed, guest HTTP/RMQ access, filters, discounted price sorting, pagination, hidden rows, gram availability, admin inventory RBAC, atomic/idempotent purchases, cost validation, reserved-stock safety, stale/competing adjustments, reservation race, piece units and paginated journal.',
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
  await db.catalogCommand.deleteMany({
    where: { entityId: { in: [...catalogFixtureIds, ...catalogCategoryIds, ...promotionIds] } },
  });
  await db.purchaseBatch.deleteMany({ where: { productId: { in: catalogFixtureIds } } });
  await db.inventoryCommand.deleteMany({ where: { productId: { in: catalogFixtureIds } } });
  await db.stockMovement.deleteMany({ where: { productId: { in: catalogFixtureIds } } });
  await db.productVariant.deleteMany({ where: { productId: { in: catalogFixtureIds } } });
  await db.product.deleteMany({ where: { id: { in: catalogFixtureIds } } });
  await db.category.deleteMany({ where: { id: { in: catalogCategoryIds } } });
  await db.mediaAsset.deleteMany({ where: { id: { in: mediaFixtureIds } } });
  await rm(mediaDirectory, { recursive: true, force: true });
  await db.purchaseBatch.deleteMany({ where: { productId: { in: inventoryFixtureIds } } });
  await db.inventoryCommand.deleteMany({ where: { productId: { in: inventoryFixtureIds } } });
  await db.stockMovement.deleteMany({ where: { productId: { in: inventoryFixtureIds } } });
  await db.stockReservation.deleteMany({ where: { orderId: { in: inventoryFixtureOrders } } });
  await db.processedEvent.deleteMany({ where: { eventId: { in: inventoryFixtureEvents } } });
  for (const orderId of inventoryFixtureOrders)
    await db.outbox.deleteMany({
      where: { payload: { path: ['payload', 'orderId'], equals: orderId } },
    });
  await db.productVariant.deleteMany({ where: { productId: { in: inventoryFixtureIds } } });
  await db.product.deleteMany({ where: { id: { in: inventoryFixtureIds } } });
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
