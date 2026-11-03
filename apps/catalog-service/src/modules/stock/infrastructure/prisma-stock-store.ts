import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CartItemInput,
  CartQuote,
  OrderCreated,
  OrderCancelled,
  CheckoutEvent,
} from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { effectivePrice } from '../../catalog/domain/pricing';
import { StockStore } from '../domain/stock-store';
@Injectable()
export class PrismaStockStore extends StockStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async quote(items: CartItemInput[]): Promise<CartQuote> {
    const now = new Date();
    return this.db.$transaction(
      async (tx) => {
        const variants = await tx.productVariant.findMany({
          where: {
            id: { in: items.map((x) => x.variantId) },
            isActive: true,
            product: { isActive: true, category: { isActive: true } },
          },
          include: {
            product: {
              include: {
                inventory: true,
                promotionTargets: { include: { promotion: true } },
                category: { include: { promotionTargets: { include: { promotion: true } } } },
              },
            },
          },
        });
        const grams = new Map<string, number>();
        for (const item of items) {
          const v = variants.find((v) => v.id === item.variantId);
          if (v)
            grams.set(v.productId, (grams.get(v.productId) ?? 0) + v.weightGrams * item.quantity);
        }
        const quoted = items.flatMap((item) => {
          const v = variants.find((v) => v.id === item.variantId);
          if (!v) return [];
          const p = v.product;
          const promos = [...p.promotionTargets, ...p.category.promotionTargets].map(
            (t) => t.promotion,
          );
          return [
            {
              ...item,
              productId: p.id,
              slug: p.slug,
              name: p.name,
              weightGrams: v.weightGrams,
              unitPrice: effectivePrice(v.price, promos, now),
              originalPrice: v.price,
              inStock:
                (p.inventory?.stockGrams ?? 0) - (p.inventory?.reservedGrams ?? 0) >=
                (grams.get(p.id) ?? 0),
            },
          ];
        });
        const subtotal = quoted.reduce((n, x) => n + x.originalPrice * x.quantity, 0);
        const total = quoted.reduce((n, x) => n + x.unitPrice * x.quantity, 0);
        if (!Number.isSafeInteger(subtotal) || subtotal > 2147483647)
          throw new Error('Cart total exceeds limit');
        return {
          items: quoted,
          unavailableVariantIds: items
            .filter((x) => !variants.some((v) => v.id === x.variantId))
            .map((x) => x.variantId),
          subtotal,
          discount: subtotal - total,
          total,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async apply(event: OrderCreated | OrderCancelled) {
    await this.db.$transaction(
      async (tx) => {
        const orderId = event.payload.orderId;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orderId},0))`;
        if (await tx.processedEvent.findUnique({ where: { eventId: event.eventId } })) return;
        const existing = await tx.stockReservation.findUnique({ where: { orderId } });
        if (event.name === 'OrderCancelled') {
          if (existing?.status === 'RESERVED') {
            for (const item of existing.items as unknown as {
              productId: string;
              grams: number;
            }[]) {
              await tx.inventory.update({
                where: { productId: item.productId },
                data: { reservedGrams: { decrement: item.grams } },
              });
            }
          }
          await tx.stockReservation.upsert({
            where: { orderId },
            create: { orderId, status: 'RELEASED', items: [] },
            update: { status: 'RELEASED' },
          });
        } else if (!existing) {
          const totals = new Map<string, number>();
          let valid = true;
          for (const line of event.payload.items) {
            const variant = await tx.productVariant.findFirst({
              where: {
                id: line.variantId,
                productId: line.productId,
                weightGrams: line.weightGrams,
                isActive: true,
                product: { isActive: true, category: { isActive: true } },
              },
            });
            if (!variant) valid = false;
            totals.set(
              line.productId,
              (totals.get(line.productId) ?? 0) + line.weightGrams * line.quantity,
            );
          }
          const reserved = [...totals.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([productId, grams]) => ({ productId, grams }));
          for (const item of reserved) {
            const rows = await tx.$queryRaw<
              { stock_grams: number; reserved_grams: number }[]
            >`SELECT stock_grams,reserved_grams FROM inventory WHERE product_id=${item.productId}::uuid FOR UPDATE`;
            if (!rows[0] || rows[0].stock_grams - rows[0].reserved_grams < item.grams)
              valid = false;
          }
          if (valid)
            for (const item of reserved)
              await tx.inventory.update({
                where: { productId: item.productId },
                data: { reservedGrams: { increment: item.grams } },
              });
          await tx.stockReservation.create({
            data: { orderId, status: valid ? 'RESERVED' : 'FAILED', items: reserved },
          });
          const result: CheckoutEvent = {
            eventId: randomUUID(),
            name: valid ? 'StockReserved' : 'StockReservationFailed',
            version: 1,
            occurredAt: new Date().toISOString(),
            correlationId: event.correlationId,
            payload: { orderId },
          };
          await tx.outbox.create({
            data: {
              id: result.eventId,
              eventName: result.name,
              payload: result as unknown as Prisma.InputJsonValue,
              correlationId: result.correlationId,
            },
          });
        }
        await tx.processedEvent.create({ data: { eventId: event.eventId } });
      },
      { timeout: 10000 },
    );
  }
}
