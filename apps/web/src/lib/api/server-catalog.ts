import 'server-only';
import { cache } from 'react';
import { catalogApi } from './catalog';
export const getCategories = cache(async () => catalogApi.categories());

export const getProduct = cache(async (slug: string) => catalogApi.product(slug));
