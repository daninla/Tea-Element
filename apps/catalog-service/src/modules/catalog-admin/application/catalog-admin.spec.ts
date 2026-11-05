import { ReadCatalogAdmin } from './read-catalog-admin';
import { WriteCatalogAdmin } from './write-catalog-admin';
import { UploadCatalogImage } from './upload-catalog-image';
import { ReadCatalogImage } from './read-catalog-image';
import type { CatalogAdminStore, CatalogMediaStore } from '../domain/catalog-admin-store';
it('forwards read and write intent with the trusted actor and preserves failures', async () => {
  const read = jest.fn().mockResolvedValue({ items: [] }),
    write = jest.fn().mockRejectedValue(new Error('unavailable'));
  const store = { read, write } as unknown as CatalogAdminStore;
  const query = { kind: 'PRODUCTS', page: 1 } as const;
  await expect(new ReadCatalogAdmin(store).execute(query)).resolves.toEqual({ items: [] });
  expect(read).toHaveBeenCalledWith(query);
  const command = {
    kind: 'CREATE_CATEGORY',
    key: 'key',
    input: {
      slug: 'tea',
      name: 'Tea',
      description: '',
      section: 'TEA',
      sortOrder: 0,
      isActive: true,
    },
  } as const;
  await expect(new WriteCatalogAdmin(store).execute(command, 'actor')).rejects.toThrow(
    'unavailable',
  );
  expect(write).toHaveBeenCalledWith(command, 'actor');
});
it('forwards media ownership and reads without swallowing failures', async () => {
  const upload = jest.fn().mockResolvedValue({ path: '/media/id.webp' }),
    get = jest.fn().mockRejectedValue(new Error('missing'));
  const store = { upload, get } as unknown as CatalogMediaStore;
  await expect(new UploadCatalogImage(store).execute('bytes', 'actor')).resolves.toEqual({
    path: '/media/id.webp',
  });
  expect(upload).toHaveBeenCalledWith('bytes', 'actor');
  await expect(new ReadCatalogImage(store).execute('id')).rejects.toThrow('missing');
  expect(get).toHaveBeenCalledWith('id');
});
