/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CatalogQuery, CategoryView } from '@tea/contracts';
import { FilterForm } from './filter-form';
jest.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const categories: CategoryView[] = ['oolong', 'puer'].map((slug) => ({
  id: slug,
  slug,
  name: slug,
  description: '',
  sortOrder: 0,
  productsCount: 1,
}));
describe('catalog filter navigation regression', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  async function render(query: CatalogQuery) {
    const view = await FilterForm({ categories, query, prefix: 'desktop' });
    await act(async () => root.render(view));
  }
  function field<T extends HTMLInputElement | HTMLSelectElement>(name: string) {
    return container.querySelector<T>(`[name="${name}"]`)!;
  }
  it('replaces stale draft inputs and selects when the applied query changes', async () => {
    await render({ section: 'TEA' });
    field<HTMLInputElement>('q').value = 'Габа';
    field<HTMLSelectElement>('category').value = 'oolong';
    field<HTMLSelectElement>('sort').value = 'price_desc';
    field<HTMLInputElement>('onSale').checked = true;
    await render({ section: 'TEA', category: 'puer', sort: 'price_asc' });
    expect(field<HTMLInputElement>('q').value).toBe('');
    expect(field<HTMLSelectElement>('category').value).toBe('puer');
    expect(field<HTMLSelectElement>('sort').value).toBe('price_asc');
    expect(field<HTMLInputElement>('onSale').checked).toBe(false);
  });
  it.each([
    ['TEA', '/catalog'],
    ['EQUIPMENT', '/teaware'],
    ['ALL', '/catalog?section=ALL'],
  ] as const)(
    'links to an unfiltered %s catalog regardless of draft or applied filters',
    async (section, href) => {
      await render({ section, q: 'Габа', page: 2, onSale: true });
      field<HTMLInputElement>('q').value = 'Зелений';
      expect(container.querySelector('.filter-reset')?.getAttribute('href')).toBe(href);
    },
  );
  it('restores a filtered URL and then the unfiltered URL without leaking old controls', async () => {
    await render({
      section: 'ALL',
      q: 'Габа',
      category: 'oolong',
      sort: 'price_desc',
      onSale: true,
    });
    await render({ section: 'ALL' });
    expect(field<HTMLInputElement>('q').value).toBe('');
    expect(field<HTMLSelectElement>('category').value).toBe('');
    expect(field<HTMLSelectElement>('sort').value).toBe('newest');
    expect(field<HTMLInputElement>('onSale').checked).toBe(false);
  });
});
