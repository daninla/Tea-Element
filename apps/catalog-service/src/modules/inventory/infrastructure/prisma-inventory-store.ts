import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  InventoryFilters,
  InventoryItem,
  InventoryHistory,
  InventoryCommandResult,
  PurchaseInput,
  AdjustmentInput,
} from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { InventoryStore } from '../domain/inventory-store';
import {
  InventoryError,
  adjustedStock,
  validPurchaseDate,
  validatePurchase,
} from '../domain/inventory-policy';
type Row = {
  productId: string;
  name: string;
  slug: string;
  category: string;
  active: boolean;
  unit: 'GRAM' | 'PIECE';
  stock: number;
  reserved: number;
  lowStockThreshold: number;
};
const columns = Prisma.sql`p.id AS "productId",p.name,p.slug,c.name AS category,p.is_active AS active,CASE WHEN c.section='EQUIPMENT' THEN 'PIECE' ELSE 'GRAM' END AS unit,CASE WHEN c.section='EQUIPMENT' THEN i.stock_pieces ELSE i.stock_grams END AS stock,CASE WHEN c.section='EQUIPMENT' THEN i.reserved_pieces ELSE i.reserved_grams END AS reserved,CASE WHEN c.section='EQUIPMENT' THEN i.low_stock_threshold_pieces ELSE i.low_stock_threshold_grams END AS "lowStockThreshold"`;
const tables = Prisma.sql`FROM inventory i JOIN products p ON p.id=i.product_id JOIN categories c ON c.id=p.category_id`;
function item(row: Row): InventoryItem {
  return { ...row, available: row.stock - row.reserved };
}
@Injectable()
export class PrismaInventoryStore extends InventoryStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async list(input: InventoryFilters) {
    const clauses: Prisma.Sql[] = [];
    if (input.q?.trim()) {
      const q = '%' + input.q.trim().replace(/[\\%_]/g, '\\$&') + '%';
      clauses.push(Prisma.sql`(p.name ILIKE ${q} OR p.slug ILIKE ${q})`);
    }
    if (input.section && input.section !== 'ALL')
      clauses.push(Prisma.sql`c.section::text=${input.section}`);
    if (input.lowStock)
      clauses.push(
        Prisma.sql`CASE WHEN c.section='EQUIPMENT' THEN i.stock_pieces-i.reserved_pieces<=i.low_stock_threshold_pieces ELSE i.stock_grams-i.reserved_grams<=i.low_stock_threshold_grams END`,
      );
    const where = clauses.length
      ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`
      : Prisma.empty;
    return this.db.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total ${tables} ${where}`,
        );
        const rows = await tx.$queryRaw<Row[]>(
          Prisma.sql`SELECT ${columns} ${tables} ${where} ORDER BY p.name,p.id LIMIT 20 OFFSET ${(input.page - 1) * 20}`,
        );
        const total = Number(count!.total);
        return {
          items: rows.map(item),
          page: input.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async read(tx: Prisma.TransactionClient, id: string) {
    const [row] = await tx.$queryRaw<Row[]>(
      Prisma.sql`SELECT ${columns} ${tables} WHERE p.id=${id}::uuid`,
    );
    if (!row) throw new InventoryError('INVENTORY_NOT_FOUND', 'Inventory not found', 404);
    return item(row);
  }
  get(id: string) {
    return this.read(this.db, id);
  }
  async history(
    productId: string | undefined,
    kind: 'MOVEMENTS' | 'PURCHASES',
    page: number,
  ): Promise<InventoryHistory> {
    return this.db.$transaction(
      async (tx) => {
        if (productId) await this.read(tx, productId);
        const where = productId ? { productId } : {};
        if (kind === 'PURCHASES') {
          const total = await tx.purchaseBatch.count({ where });
          const rows = await tx.purchaseBatch.findMany({
            where,
            orderBy: [{ purchasedAt: 'desc' }, { id: 'asc' }],
            take: 20,
            skip: (page - 1) * 20,
          });
          return {
            kind,
            items: rows.map((x) => ({
              id: x.id,
              productId: x.productId,
              actorId: x.actorId,
              quantity: x.quantity,
              purchasePriceTotal: x.purchasePriceTotal,
              supplier: x.supplier,
              note: x.note,
              unit: x.unit as 'GRAM' | 'PIECE',
              purchasedAt: x.purchasedAt.toISOString(),
              createdAt: x.createdAt.toISOString(),
            })),
            page,
            total,
            totalPages: Math.max(1, Math.ceil(total / 20)),
          };
        }
        const total = await tx.stockMovement.count({ where });
        const rows = await tx.stockMovement.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 20,
          skip: (page - 1) * 20,
        });
        const names = await tx.product.findMany({
          where: { id: { in: rows.map((x) => x.productId) } },
          select: { id: true, name: true },
        });
        return {
          kind,
          items: rows.map((x) => ({
            id: x.id,
            productId: x.productId,
            productName: names.find((p) => p.id === x.productId)?.name ?? x.productId,
            orderId: x.orderId,
            actorId: x.actorId,
            referenceId: x.referenceId,
            note: x.note,
            type: x.type,
            unit: x.unit,
            quantity: x.quantity,
            stockDelta: x.stockDelta,
            reservedDelta: x.reservedDelta,
            createdAt: x.createdAt.toISOString(),
          })),
          page,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  purchase(input: PurchaseInput, actorId: string) {
    return this.command('PURCHASE', input, actorId);
  }
  adjust(input: AdjustmentInput, actorId: string) {
    return this.command(input.kind, input, actorId);
  }
  private async command(
    kind: 'PURCHASE' | 'ADJUSTMENT' | 'WRITE_OFF',
    input: PurchaseInput | AdjustmentInput,
    actorId: string,
  ): Promise<InventoryCommandResult> {
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          actorId,
          kind,
          productId: input.productId,
          ...('quantity' in input
            ? {
                quantity: input.quantity,
                purchasePriceTotal: input.purchasePriceTotal,
                supplier: input.supplier,
                purchasedAt: input.purchasedAt,
                note: input.note,
              }
            : { delta: input.delta, expectedStock: input.expectedStock, reason: input.reason }),
        }),
      )
      .digest('hex');
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory-command:${input.key}`},0))`;
      const previous = await tx.inventoryCommand.findUnique({ where: { key: input.key } });
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new InventoryError('IDEMPOTENCY_CONFLICT', 'Command key reused', 409);
        return previous.result as unknown as InventoryCommandResult;
      }
      await tx.$queryRaw`SELECT id FROM inventory WHERE product_id=${input.productId}::uuid FOR UPDATE`;
      const row = await this.read(tx, input.productId);
      const purchase = 'quantity' in input;
      if (!purchase && row.stock !== input.expectedStock)
        throw new InventoryError('STOCK_CONFLICT', 'Stock changed; reload before retrying', 409);
      if (!purchase && kind === 'WRITE_OFF' && input.delta >= 0)
        throw new InventoryError('INVALID_INPUT', 'Write-off must reduce stock', 400);
      if (purchase) validatePurchase(input.quantity, input.purchasePriceTotal);
      const delta = purchase ? input.quantity : input.delta;
      const stock = adjustedStock(row.stock, row.reserved, delta);
      const date = purchase ? validPurchaseDate(input.purchasedAt) : null;
      const commandId = randomUUID(),
        movementId = randomUUID(),
        purchaseId = purchase ? randomUUID() : null;
      const result: InventoryCommandResult = {
        commandId,
        productId: row.productId,
        unit: row.unit,
        stock,
        reserved: row.reserved,
        available: stock - row.reserved,
        purchaseId,
        movementId,
      };
      await tx.inventory.update({
        where: { productId: row.productId },
        data: row.unit === 'PIECE' ? { stockPieces: stock } : { stockGrams: stock },
      });
      if (purchase)
        await tx.purchaseBatch.create({
          data: {
            id: purchaseId!,
            commandId,
            productId: row.productId,
            actorId,
            unit: row.unit,
            quantity: input.quantity,
            purchasePriceTotal: input.purchasePriceTotal,
            supplier: input.supplier,
            purchasedAt: date!,
            note: input.note,
          },
        });
      await tx.stockMovement.create({
        data: {
          id: movementId,
          productId: row.productId,
          actorId,
          referenceId: commandId,
          note: purchase ? input.note : input.reason,
          type: kind,
          unit: row.unit,
          quantity: Math.abs(delta),
          stockDelta: delta,
          reservedDelta: 0,
        },
      });
      await tx.inventoryCommand.create({
        data: {
          id: commandId,
          key: input.key,
          productId: row.productId,
          actorId,
          kind,
          fingerprint,
          result: result as unknown as Prisma.InputJsonObject,
        },
      });
      return result;
    });
  }
}
