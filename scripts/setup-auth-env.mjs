import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
if (process.env.NODE_ENV === 'production')
  throw new Error('Provision production secrets explicitly');
const names = ['auth-service', 'gateway'];
const contents = await Promise.all(
  names.map(async (name) => {
    const file = path.join(root, 'apps', name, '.env');
    try {
      return await readFile(file, 'utf8');
    } catch {
      return null;
    }
  }),
);
const existing = contents.map((s) => s?.match(/^JWT_ACCESS_SECRET=(.+)$/m)?.[1]).filter(Boolean);
if (new Set(existing).size > 1)
  throw new Error('Auth and gateway signing keys differ; reconcile local .env files');
const secret = process.env.JWT_ACCESS_SECRET || existing[0] || randomBytes(48).toString('hex');
for (const [index, name] of names.entries()) {
  const file = path.join(root, 'apps', name, '.env');
  let content =
    contents[index] ?? (await readFile(path.join(root, 'apps', name, '.env.example'), 'utf8'));
  if (!/^JWT_ACCESS_SECRET=.+$/m.test(content)) {
    content = /^JWT_ACCESS_SECRET=.*$/m.test(content)
      ? content.replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret}`)
      : `${content}\nJWT_ACCESS_SECRET=${secret}\n`;
  }
  if (name === 'auth-service' && !/^ADMIN_PASSWORD=.+$/m.test(content))
    content = content.replace(
      /^ADMIN_PASSWORD=.*$/m,
      `ADMIN_PASSWORD=${randomBytes(24).toString('base64url')}`,
    );
  await writeFile(file, content, { mode: 0o600 });
  await chmod(file, 0o600);
}
// Never print credentials. The owner can inspect their private auth-service/.env if needed.
console.log('Local auth environment is ready. Secrets are stored only in ignored .env files.');

const catalogEnv = path.join(root, 'apps/catalog-service/.env');
try {
  await readFile(catalogEnv);
} catch {
  await writeFile(
    catalogEnv,
    await readFile(path.join(root, 'apps/catalog-service/.env.example')),
    { mode: 0o600 },
  );
}

const ordersEnv = path.join(root, 'apps/orders-service/.env');
let ordersContent;
try {
  ordersContent = await readFile(ordersEnv, 'utf8');
} catch {
  ordersContent = await readFile(path.join(root, 'apps/orders-service/.env.example'), 'utf8');
}
if (!/^ORDER_ACCESS_SECRET=.+$/m.test(ordersContent)) {
  ordersContent =
    ordersContent.replace(/^ORDER_ACCESS_SECRET=.*$/m, '') +
    `\nORDER_ACCESS_SECRET=${randomBytes(48).toString('hex')}\n`;
}
await writeFile(ordersEnv, ordersContent, { mode: 0o600 });
await chmod(ordersEnv, 0o600);
