/** @jest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProductPage, ProductView } from '@tea/contracts';
import { catalogApi } from '@/lib/api/catalog';
import { Search } from './search';
let mockPathname = '/catalog';
let mockSearch = '';
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { query?: string }) =>
    values?.query ? `${key}: ${values.query}` : key,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
jest.mock('@/lib/api/catalog', () => ({ catalogApi: { products: jest.fn() } }));
const products = jest.mocked(catalogApi.products);
const product: ProductView = {
  id: 'gaba',
  slug: 'gaba-oolong',
  name: 'Габа Улун',
  nameOriginal: '',
  description: '',
  origin: '',
  year: null,
  brewingGuide: null,
  images: [],
  tags: [],
  category: { id: 'gaba', slug: 'gaba', name: 'Габа', description: '', sortOrder: 0 },
  variants: [],
  minPrice: 15000,
  onSale: false,
  inStock: true,
  createdAt: '2026-11-03T00:00:00Z',
};
const page: ProductPage = { items: [product], total: 1, page: 1, pageSize: 4, totalPages: 1 };
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
describe('search navigation regression', () => {
  let root: Root, container: HTMLDivElement, client: QueryClient;
  beforeEach(() => {
    jest.useFakeTimers();
    mockPathname = '/catalog';
    mockSearch = '';
    mockPush.mockReset();
    products.mockReset();
    products.mockResolvedValue(page);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  });
  afterEach(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
    jest.useRealTimers();
  });
  function render() {
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Search />
        </QueryClientProvider>,
      ),
    );
  }
  function input() {
    return container.querySelector<HTMLInputElement>('input[name="q"]')!;
  }
  function type(value: string) {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input(),
        value,
      );
      input().dispatchEvent(new Event('input', { bubbles: true }));
      input().focus();
    });
  }
  async function settle() {
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
  }
  it('does not offer the previous product after search → product → all tea', async () => {
    render();
    type('Габа');
    await settle();
    expect(container.textContent).toContain('Габа Улун');
    mockPathname = '/product/gaba-oolong';
    render();
    mockPathname = '/catalog';
    render();
    act(() => input().focus());
    expect(input().value).toBe('');
    expect(container.textContent).not.toContain('Габа Улун');
    expect(container.querySelector('a[href*="q="]')).toBeNull();
  });
  it('restores only the query in the current URL on back/forward', () => {
    mockSearch = 'section=ALL&q=%D0%BF%D1%83%D0%B5%D1%80';
    render();
    expect(input().value).toBe('пуер');
    mockPathname = '/product/gaba-oolong';
    mockSearch = '';
    render();
    expect(input().value).toBe('');
    mockPathname = '/catalog';
    mockSearch = 'section=ALL&q=%D0%BF%D1%83%D0%B5%D1%80';
    render();
    expect(input().value).toBe('пуер');
    mockSearch = '';
    render();
    expect(input().value).toBe('');
  });
  it('hides old suggestions immediately while a different query is being debounced', async () => {
    render();
    type('Габа');
    await settle();
    expect(container.textContent).toContain('Габа Улун');
    type('гайвань');
    expect(container.textContent).not.toContain('Габа Улун');
  });
  it('clears suggestions immediately when the field is cleared', async () => {
    render();
    type('Габа');
    await settle();
    type('');
    expect(container.textContent).not.toContain('Габа Улун');
    expect(container.querySelector('.search-results')).toBeNull();
  });
  it('submits trimmed text and treats whitespace as an unfiltered catalog', () => {
    render();
    type('  Габа  ');
    act(() =>
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    expect(mockPush).toHaveBeenLastCalledWith('/catalog?section=ALL&q=%D0%93%D0%B0%D0%B1%D0%B0');
    type('   ');
    act(() =>
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    expect(mockPush).toHaveBeenLastCalledWith('/catalog?section=ALL');
  });
});
