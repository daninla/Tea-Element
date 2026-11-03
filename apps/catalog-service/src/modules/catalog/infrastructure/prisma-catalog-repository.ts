import { Inject, Injectable } from '@nestjs/common';
import type { BrewingGuide, CatalogQuery } from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { CatalogRepository, type CatalogProduct } from '../domain/catalog-repository';
function include(now: Date) {
  const promotions = { promotion: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } } };
  return {
    category: {
      include: { promotionTargets: { where: promotions, include: { promotion: true } } },
    },
    variants: { where: { isActive: true }, orderBy: { weightGrams: 'asc' as const } },
    inventory: true,
    promotionTargets: { where: promotions, include: { promotion: true } },
  } satisfies Prisma.ProductInclude;
}
type Loaded = Prisma.ProductGetPayload<{ include: ReturnType<typeof include> }>;
function mapped(product: Loaded): CatalogProduct {
  const category = product.category;
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    nameOriginal: product.nameOriginal,
    description: product.description,
    origin: product.origin,
    year: product.year,
    brewingGuide: product.brewingGuide as unknown as BrewingGuide,
    images: product.images,
    tags: product.tags,
    createdAt: product.createdAt,
    category: {
      id: category.id,
      section: category.section,
      slug: category.slug,
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
    },
    variants: product.variants,
    inventory: product.inventory,
    promotions: [...product.promotionTargets, ...category.promotionTargets].map((t) => t.promotion),
  };
}
@Injectable()
export class PrismaCatalogRepository extends CatalogRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async categories() {
    const rows = await this.db.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      include: {
        _count: {
          select: {
            products: { where: { isActive: true, variants: { some: { isActive: true } } } },
          },
        },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      section: c.section,
      slug: c.slug,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      productsCount: c._count.products,
    }));
  }
  async bySlug(slug: string, now: Date) {
    const product = await this.db.product.findFirst({
      where: {
        slug,
        isActive: true,
        category: { isActive: true },
        variants: { some: { isActive: true } },
      },
      include: include(now),
    });
    return product ? mapped(product) : null;
  }
  async list(
    query: CatalogQuery & {
      page: number;
      pageSize: number;
      sort: NonNullable<CatalogQuery['sort']>;
    },
    now: Date,
  ) {
    const search = query.q ? `%${query.q.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const where = Prisma.sql`p.is_active = TRUE AND c.is_active = TRUE
      ${query.section === 'ALL' || (query.section === undefined && query.category) ? Prisma.empty : Prisma.sql`AND c.section::text = ${query.section ?? 'TEA'}`}
      AND ((c.section='TEA' AND v.weight_grams > 0) OR (c.section='EQUIPMENT' AND v.weight_grams IS NULL))
      ${query.category ? Prisma.sql`AND c.slug = ${query.category}` : Prisma.empty}
      ${query.origin ? Prisma.sql`AND p.origin ILIKE ${query.origin.replace(/[\\%_]/g, '\\$&')}` : Prisma.empty}
      ${search ? Prisma.sql`AND (p.name ILIKE ${search} OR p.name_original ILIKE ${search} OR p.description ILIKE ${search})` : Prisma.empty}`;
    // Both the SQL projection and domain mapper use best single promotion, integer discount floor,
    // [startsAt, endsAt), active variants and stock minus reserved grams.
    const selection = Prisma.sql`WITH variants AS (
      SELECT p.id, p.created_at, p.sales_count, v.price,
        CASE WHEN c.section='EQUIPMENT' THEN GREATEST(0,COALESCE(i.stock_pieces,0)-COALESCE(i.reserved_pieces,0))>=1 ELSE GREATEST(0, COALESCE(i.stock_grams,0) - COALESCE(i.reserved_grams,0)) >= v.weight_grams END AS in_stock,
        LEAST(v.price, COALESCE((SELECT MIN(GREATEST(0, CASE WHEN promo.type = 'PERCENT'
          THEN v.price - (v.price::bigint * promo.value / 100) ELSE v.price::bigint - promo.value END))
          FROM promotions promo WHERE promo.is_active = TRUE AND promo.starts_at <= ${now} AND promo.ends_at > ${now}
          AND promo.value >= 0 AND (promo.type <> 'PERCENT' OR promo.value <= 100)
          AND EXISTS (SELECT 1 FROM promotion_targets pt WHERE pt.promotion_id = promo.id AND (pt.product_id = p.id OR pt.category_id = p.category_id))), v.price))::int AS effective_price
      FROM products p JOIN categories c ON c.id = p.category_id
      JOIN product_variants v ON v.product_id = p.id AND v.is_active = TRUE
      LEFT JOIN inventory i ON i.product_id = p.id WHERE ${where}
    ), priced AS (
      SELECT id, created_at, sales_count, MIN(effective_price)::int AS min_price,
        BOOL_OR(effective_price < price) AS on_sale, BOOL_OR(in_stock) AS in_stock
      FROM variants GROUP BY id, created_at, sales_count
    ), filtered AS (SELECT * FROM priced WHERE TRUE
      ${query.minPrice !== undefined ? Prisma.sql`AND min_price >= ${query.minPrice}` : Prisma.empty}
      ${query.maxPrice !== undefined ? Prisma.sql`AND min_price <= ${query.maxPrice}` : Prisma.empty}
      ${query.onSale !== undefined ? Prisma.sql`AND on_sale = ${query.onSale}` : Prisma.empty}
      ${query.inStock !== undefined ? Prisma.sql`AND in_stock = ${query.inStock}` : Prisma.empty})`;
    const order =
      query.sort === 'price_asc'
        ? Prisma.sql`min_price ASC, id ASC`
        : query.sort === 'price_desc'
          ? Prisma.sql`min_price DESC, id ASC`
          : query.sort === 'popular'
            ? Prisma.sql`sales_count DESC, created_at DESC, id ASC`
            : Prisma.sql`created_at DESC, id ASC`;
    return this.db.$transaction(
      async (tx) => {
        const count = await tx.$queryRaw<{ total: number }[]>(
          Prisma.sql`${selection} SELECT COUNT(*)::int AS total FROM filtered`,
        );
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`${selection} SELECT id FROM filtered ORDER BY ${order} OFFSET ${(query.page - 1) * query.pageSize} LIMIT ${query.pageSize}`,
        );
        const products = await tx.product.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
          include: include(now),
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        return { products: ids.map((r) => mapped(byId.get(r.id)!)), total: count[0]?.total ?? 0 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
