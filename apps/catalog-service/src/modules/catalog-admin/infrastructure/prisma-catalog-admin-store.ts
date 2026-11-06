import { validatePromotion } from '../domain/promotion-policy';
import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AdminProduct,
  AdminPromotion,
  CatalogWriteResult,
  AdminCategory,
  CatalogAdminRead,
  CatalogAdminWrite,
  CatalogReadResult,
} from '@tea/contracts';
import {
  Prisma,
  type Product,
  type ProductVariant,
  type Category,
} from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { CatalogAdminStore, CatalogAdminError } from '../domain/catalog-admin-store';
import { uploadedImageId, validateProductUnit } from '../domain/catalog-policy';
const category = (x: Category): AdminCategory => ({
  id: x.id,
  slug: x.slug,
  name: x.name,
  description: x.description,
  section: x.section,
  sortOrder: x.sortOrder,
  isActive: x.isActive,
  revision: x.revision,
});
function product(x: Product & { category: Category; variants: ProductVariant[] }): AdminProduct {
  return {
    id: x.id,
    revision: x.revision,
    slug: x.slug,
    name: x.name,
    nameOriginal: x.nameOriginal,
    description: x.description,
    origin: x.origin,
    year: x.year,
    brewingGuide: x.brewingGuide as AdminProduct['brewingGuide'],
    categoryId: x.categoryId,
    category: category(x.category),
    images: x.images,
    tags: x.tags,
    isActive: x.isActive,
    variants: x.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      weightGrams: v.weightGrams,
      price: v.price,
      isActive: v.isActive,
    })),
  };
}
const promotionInclude = {
  targets: {
    include: { product: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: { id: 'asc' as const },
  },
};
function promotion(
  x: Prisma.PromotionGetPayload<{ include: typeof promotionInclude }>,
): AdminPromotion {
  return {
    id: x.id,
    revision: x.revision,
    name: x.name,
    type: x.type,
    value: x.value,
    startsAt: x.startsAt.toISOString(),
    endsAt: x.endsAt.toISOString(),
    isActive: x.isActive,
    targets: x.targets.map((t) => ({
      kind: t.productId ? 'PRODUCT' : 'CATEGORY',
      id: (t.productId ?? t.categoryId)!,
      name: t.product?.name ?? t.category?.name ?? '',
    })),
  };
}
const include = {
  category: true,
  variants: { orderBy: [{ weightGrams: 'asc' as const }, { id: 'asc' as const }] },
};
@Injectable()
export class PrismaCatalogAdminStore extends CatalogAdminStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async read(input: CatalogAdminRead): Promise<CatalogReadResult> {
    return this.db.$transaction(
      async (tx) => {
        if (input.kind === 'PROMOTION') {
          const row = await tx.promotion.findUnique({
            where: { id: input.id },
            include: promotionInclude,
          });
          if (!row) throw new CatalogAdminError('PRODUCT_NOT_FOUND', 'Promotion not found', 404);
          return promotion(row);
        }
        if (input.kind === 'PRODUCT') {
          const row = await tx.product.findUnique({ where: { id: input.id }, include });
          if (!row) throw new CatalogAdminError('PRODUCT_NOT_FOUND', 'Product not found', 404);
          return product(row);
        }
        const q = 'q' in input ? input.q?.trim().replace(/[\\%_]/g, '\\$&') : undefined;
        if (input.kind === 'PROMOTIONS') {
          const where: Prisma.PromotionWhereInput = {
            ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
            ...(input.active !== undefined ? { isActive: input.active } : {}),
          };
          const total = await tx.promotion.count({ where });
          const rows = await tx.promotion.findMany({
            where,
            include: promotionInclude,
            take: 20,
            skip: (input.page - 1) * 20,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          });
          return {
            items: rows.map(promotion),
            page: input.page,
            total,
            totalPages: Math.max(1, Math.ceil(total / 20)),
          };
        }
        if (input.kind === 'PRODUCTS') {
          const where: Prisma.ProductWhereInput = {
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { slug: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
            ...(input.section ? { category: { section: input.section } } : {}),
            ...(input.active !== undefined ? { isActive: input.active } : {}),
          };
          const total = await tx.product.count({ where });
          const rows = await tx.product.findMany({
            where,
            include,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            take: 20,
            skip: (input.page - 1) * 20,
          });
          return {
            items: rows.map(product),
            page: input.page,
            total,
            totalPages: Math.max(1, Math.ceil(total / 20)),
          };
        }
        if (input.kind === 'CATEGORIES') {
          const where: Prisma.CategoryWhereInput = {
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { slug: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
            ...(input.section ? { section: input.section } : {}),
          };
          const size = input.pageSize ?? 20;
          const total = await tx.category.count({ where });
          const rows = await tx.category.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
            take: size,
            skip: (input.page - 1) * size,
          });
          return {
            items: rows.map(category),
            page: input.page,
            total,
            totalPages: Math.max(1, Math.ceil(total / size)),
          };
        }
        const where = { entityId: input.id };
        const total = await tx.catalogCommand.count({ where });
        const rows = await tx.catalogCommand.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 20,
          skip: (input.page - 1) * 20,
          select: { id: true, actorId: true, kind: true, createdAt: true },
        });
        return {
          items: rows.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
          page: input.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async write(input: CatalogAdminWrite, actorId: string): Promise<CatalogWriteResult> {
    const { key, ...intent } = input;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ actorId, ...intent }))
      .digest('hex');
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('catalog-admin-write',0))`;
        const command = await tx.catalogCommand.findUnique({ where: { key } });
        if (command) {
          if (command.fingerprint !== fingerprint)
            throw new CatalogAdminError('IDEMPOTENCY_CONFLICT', 'Command key reused', 409);
          return command.result as unknown as CatalogWriteResult;
        }
        let result: CatalogWriteResult,
          before: unknown = null;
        if (input.kind === 'CREATE_PROMOTION' || input.kind === 'UPDATE_PROMOTION') {
          validatePromotion(input.input);
          let current = null;
          if (input.kind === 'UPDATE_PROMOTION') {
            current = await tx.promotion.findUnique({
              where: { id: input.id },
              include: promotionInclude,
            });
            if (!current)
              throw new CatalogAdminError('PRODUCT_NOT_FOUND', 'Promotion not found', 404);
            before = promotion(current);
            if (current.revision !== input.expectedRevision)
              throw new CatalogAdminError('STALE_CATALOG', 'Promotion changed; reload', 409);
          }
          const products = input.input.targets.filter((x) => x.kind === 'PRODUCT').map((x) => x.id),
            categories = input.input.targets.filter((x) => x.kind === 'CATEGORY').map((x) => x.id);
          if (
            (await tx.product.count({ where: { id: { in: products } } })) !== products.length ||
            (await tx.category.count({ where: { id: { in: categories } } })) !== categories.length
          )
            throw new CatalogAdminError('INVALID_INPUT', 'Unknown promotion target', 400);
          const { targets, ...values } = input.input;
          const data = {
            ...values,
            startsAt: new Date(values.startsAt),
            endsAt: new Date(values.endsAt),
          };
          const id = current?.id ?? randomUUID();
          if (current) {
            await tx.promotion.update({
              where: { id },
              data: { ...data, revision: { increment: 1 } },
            });
            await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
          } else await tx.promotion.create({ data: { id, ...data } });
          await tx.promotionTarget.createMany({
            data: targets.map((t) => ({
              promotionId: id,
              ...(t.kind === 'PRODUCT' ? { productId: t.id } : { categoryId: t.id }),
            })),
          });
          result = promotion(
            await tx.promotion.findUniqueOrThrow({ where: { id }, include: promotionInclude }),
          );
        } else if (input.kind === 'CREATE_CATEGORY' || input.kind === 'UPDATE_CATEGORY') {
          if (input.kind === 'UPDATE_CATEGORY') {
            const current = await tx.category.findUnique({ where: { id: input.id } });
            if (!current)
              throw new CatalogAdminError('PRODUCT_NOT_FOUND', 'Category not found', 404);
            before = category(current);
            if (current.revision !== input.expectedRevision)
              throw new CatalogAdminError('STALE_CATALOG', 'Category changed; reload', 409);
            if (current.slug !== input.input.slug || current.section !== input.input.section)
              throw new CatalogAdminError(
                'IMMUTABLE_FIELD',
                'Category URL and stock section are immutable',
                409,
              );
            result = category(
              await tx.category.update({
                where: { id: input.id },
                data: { ...input.input, revision: { increment: 1 } },
              }),
            );
          } else result = category(await tx.category.create({ data: input.input }));
        } else {
          const target = await tx.category.findUnique({ where: { id: input.input.categoryId } });
          if (!target) throw new CatalogAdminError('PRODUCT_NOT_FOUND', 'Category not found', 404);
          if (input.input.isActive && !target.isActive)
            throw new CatalogAdminError(
              'INVALID_INPUT',
              'Choose an active category or save as hidden',
              400,
            );
          const current =
            input.kind === 'UPDATE_PRODUCT'
              ? await tx.product.findUnique({ where: { id: input.id }, include })
              : null;
          if (input.kind === 'UPDATE_PRODUCT' && !current)
            throw new CatalogAdminError('PRODUCT_NOT_FOUND', 'Product not found', 404);
          if (current && input.kind === 'UPDATE_PRODUCT') {
            before = product(current);
            if (current.revision !== input.expectedRevision)
              throw new CatalogAdminError('STALE_CATALOG', 'Product changed; reload', 409);
            if (current.slug !== input.input.slug || current.category.section !== target.section)
              throw new CatalogAdminError(
                'IMMUTABLE_FIELD',
                'Product URL and stock unit are immutable',
                409,
              );
          }
          validateProductUnit(input.input, target.section, current?.variants);
          const oldIds = new Set(current?.variants.map((x) => x.id));
          if (input.input.variants.some((x) => x.id && !oldIds.has(x.id)))
            throw new CatalogAdminError('INVALID_INPUT', 'Variant belongs to another product', 400);
          const assets = input.input.images.map(uploadedImageId).filter((x): x is string => !!x);
          if (
            assets.length &&
            (await tx.mediaAsset.count({ where: { id: { in: assets } } })) !== new Set(assets).size
          )
            throw new CatalogAdminError('INVALID_INPUT', 'Image is not registered', 400);
          const { variants, brewingGuide, ...fields } = input.input;
          const data = {
            ...fields,
            brewingGuide: brewingGuide
              ? (brewingGuide as unknown as Prisma.InputJsonObject)
              : Prisma.DbNull,
          };
          let id: string;
          if (current) {
            id = current.id;
            await tx.product.update({
              where: { id },
              data: { ...data, revision: { increment: 1 } },
            });
          } else {
            id = randomUUID();
            await tx.product.create({ data: { id, ...data, inventory: { create: {} } } });
          }
          for (const v of variants) {
            if (v.id)
              await tx.productVariant.update({
                where: { id: v.id },
                data: { price: v.price, isActive: v.isActive },
              });
            else
              await tx.productVariant.create({ data: { ...v, id: randomUUID(), productId: id } });
          }
          result = product(await tx.product.findUniqueOrThrow({ where: { id }, include }));
        }
        await tx.catalogCommand.create({
          data: {
            id: randomUUID(),
            key,
            actorId,
            entityId: result.id,
            kind: input.kind,
            fingerprint,
            before: before ? (before as Prisma.InputJsonObject) : Prisma.DbNull,
            result: result as unknown as Prisma.InputJsonObject,
          },
        });
        return result;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new CatalogAdminError('CATALOG_CONFLICT', 'URL or SKU is already in use', 409);
      throw e;
    }
  }
}
