import { request, OrdersApiError } from './orders';
const response = (status: number, body: unknown = {}) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;
afterEach(() => jest.restoreAllMocks());
it('shares a single refresh for simultaneous expired requests and retries each once', async () => {
  let valid = false;
  let refreshes = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    if (String(url).endsWith('/auth/refresh')) {
      refreshes++;
      valid = true;
      return response(200);
    }
    return response(valid ? 200 : 401, { ok: true });
  });
  const values = await Promise.all([request('/cart'), request('/orders?page=1')]);
  expect(values).toEqual([{ ok: true }, { ok: true }]);
  expect(refreshes).toBe(1);
});
it('never refreshes rejected credentials or retries an unauthorized response indefinitely', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(response(401));
  await expect(request('/auth/login', 'POST', {})).rejects.toBeInstanceOf(OrdersApiError);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockClear();
  await expect(request('/cart')).rejects.toBeInstanceOf(OrdersApiError);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('sends multipart bytes without a JSON content type and preserves the retry key', async () => {
  const form = new FormData();
  form.set('file', new Blob(['image']), 'photo.png');
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(response(200, { id: 'asset' }));
  await expect(request('/admin/media', 'POST', form, 'key')).resolves.toEqual({ id: 'asset' });
  const options = fetcher.mock.calls[0]![1]!;
  expect(options.body).toBe(form);
  expect(options.headers).toEqual({ 'Idempotency-Key': 'key' });
});
