import { randomUUID } from 'node:crypto';
import { adminWrite } from './catalog-admin-schema';
import { CatalogAdminRpcController } from './catalog-admin-rpc.controller';
import { ReadCatalogAdmin } from '../application/read-catalog-admin';
import type { WriteCatalogAdmin } from '../application/write-catalog-admin';
import type { UploadCatalogImage } from '../application/upload-catalog-image';
import type { ReadCatalogImage } from '../application/read-catalog-image';
it('rejects forged actors and customer context before invoking a use case', async () => {
  const execute = jest.fn();
  const controller = new CatalogAdminRpcController(
    { execute } as unknown as ReadCatalogAdmin,
    {} as WriteCatalogAdmin,
    {} as UploadCatalogImage,
    {} as ReadCatalogImage,
  );
  const input = { kind: 'PRODUCTS', page: 1 };
  for (const context of [
    { userId: randomUUID(), role: 'CUSTOMER', correlationId: 'test' },
    { userId: randomUUID(), role: 'ADMIN', correlationId: 'test', actorId: randomUUID() },
  ])
    expect(await controller.query({ input, context })).toMatchObject({
      ok: false,
      error: { statusCode: 403 },
    });
  expect(execute).not.toHaveBeenCalled();
});
it('rejects unknown command fields, invalid revisions and prices', () => {
  const x = {
    kind: 'CREATE_PRODUCT',
    key: randomUUID(),
    input: {
      slug: 'tea',
      name: 'Tea',
      nameOriginal: '',
      description: 'Test',
      origin: '',
      year: null,
      brewingGuide: null,
      categoryId: randomUUID(),
      images: [],
      tags: [],
      isActive: false,
      variants: [{ sku: 'tea', weightGrams: 25, price: 100, isActive: true }],
    },
  };
  expect(adminWrite.safeParse(x).success).toBe(true);
  expect(adminWrite.safeParse({ ...x, actorId: randomUUID() }).success).toBe(false);
  expect(
    adminWrite.safeParse({
      ...x,
      input: { ...x.input, variants: [{ ...x.input.variants[0], price: 1.5 }] },
    }).success,
  ).toBe(false);
  expect(
    adminWrite.safeParse({ ...x, kind: 'UPDATE_PRODUCT', id: randomUUID(), expectedRevision: -1 })
      .success,
  ).toBe(false);
});
