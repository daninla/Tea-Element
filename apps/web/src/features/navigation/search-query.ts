export function searchHref(value: string) {
  const params = new URLSearchParams({ section: 'ALL' });
  const query = value.trim();
  if (query) params.set('q', query);
  return `/catalog?${params.toString()}`;
}
