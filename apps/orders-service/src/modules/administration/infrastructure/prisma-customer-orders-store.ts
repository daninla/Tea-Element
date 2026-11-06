import { Inject, Injectable } from '@nestjs/common';
import type {
  OrderCustomerQuery,
  GuestCustomerPage,
  CustomerHistory,
  AdminOrderSummary,
} from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { OrderError } from '../../orders/domain/order-store';
import { reportNumber } from '../domain/admin-dashboard-store';
import { CustomerOrdersStore } from '../domain/customer-orders-store';
@Injectable()
export class PrismaCustomerOrdersStore extends CustomerOrdersStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  read(input: OrderCustomerQuery): Promise<GuestCustomerPage | CustomerHistory> {
    return this.db.$transaction(
      async (tx) => {
        if (input.kind === 'GUESTS') {
          const term = '%' + (input.q?.trim().replace(/[\\%_]/g, '\\$&') ?? '') + '%';
          const grouped = Prisma.sql`SELECT lower(btrim(customer_email)) AS email,(array_agg(customer_first_name ORDER BY created_at DESC,id))[1] AS "firstName",(array_agg(customer_last_name ORDER BY created_at DESC,id))[1] AS "lastName",(array_agg(customer_phone ORDER BY created_at DESC,id))[1] AS phone,COUNT(*)::bigint AS "orderCount",COALESCE(SUM(total) FILTER(WHERE status='COMPLETED' AND payment_status='PAID'),0)::bigint AS "completedTotal",MAX(created_at) AS "lastOrderAt",bool_or(customer_email ILIKE ${term} OR customer_first_name ILIKE ${term} OR customer_last_name ILIKE ${term} OR customer_phone ILIKE ${term}) AS matches FROM orders WHERE user_id IS NULL GROUP BY lower(btrim(customer_email))`;
          const [count] = await tx.$queryRaw<{ total: bigint }[]>(
            Prisma.sql`WITH grouped AS (${grouped}) SELECT COUNT(*)::bigint AS total FROM grouped WHERE matches`,
          );
          type Guest = {
            email: string;
            firstName: string;
            lastName: string;
            phone: string;
            orderCount: bigint;
            completedTotal: bigint;
            lastOrderAt: Date;
          };
          const rows = await tx.$queryRaw<Guest[]>(
            Prisma.sql`WITH grouped AS (${grouped}) SELECT email,"firstName","lastName",phone,"orderCount","completedTotal","lastOrderAt" FROM grouped WHERE matches ORDER BY "lastOrderAt" DESC,email LIMIT 20 OFFSET ${(input.page - 1) * 20}`,
          );
          const total = reportNumber(count!.total);
          return {
            items: rows.map((x) => ({
              ...x,
              orderCount: reportNumber(x.orderCount),
              completedTotal: reportNumber(x.completedTotal),
              lastOrderAt: x.lastOrderAt.toISOString(),
            })),
            page: input.page,
            total,
            totalPages: Math.max(1, Math.ceil(total / 20)),
          };
        }
        const where =
          input.customer.kind === 'ACCOUNT'
            ? Prisma.sql`user_id=${input.customer.id}::uuid`
            : Prisma.sql`user_id IS NULL AND lower(btrim(customer_email))=${input.customer.email.trim().toLowerCase()}`;
        type Summary = {
          orderCount: bigint;
          completedCount: bigint;
          completedTotal: bigint;
          firstOrderAt: Date | null;
          lastOrderAt: Date | null;
        };
        const [sum] = await tx.$queryRaw<Summary[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS "orderCount",COUNT(*) FILTER(WHERE status='COMPLETED' AND payment_status='PAID')::bigint AS "completedCount",COALESCE(SUM(total) FILTER(WHERE status='COMPLETED' AND payment_status='PAID'),0)::bigint AS "completedTotal",MIN(created_at) AS "firstOrderAt",MAX(created_at) AS "lastOrderAt" FROM orders WHERE ${where}`,
        );
        const total = reportNumber(sum!.orderCount);
        if (!total && input.customer.kind === 'GUEST')
          throw new OrderError('ORDER_NOT_FOUND', 'Contact group not found', 404);
        const [contact] = await tx.$queryRaw<
          { firstName: string; lastName: string; email: string; phone: string }[]
        >(
          Prisma.sql`SELECT customer_first_name AS "firstName",customer_last_name AS "lastName",customer_email AS email,customer_phone AS phone FROM orders WHERE ${where} ORDER BY created_at DESC,id LIMIT 1`,
        );
        type Row = Omit<AdminOrderSummary, 'createdAt'> & { createdAt: Date };
        const rows = await tx.$queryRaw<Row[]>(
          Prisma.sql`SELECT id,number,status,total,customer_first_name AS "firstName",customer_last_name AS "lastName",customer_email AS email,payment_method AS "paymentMethod",payment_status AS "paymentStatus",created_at AS "createdAt",user_id AS "userId" FROM orders WHERE ${where} ORDER BY created_at DESC,id LIMIT 20 OFFSET ${(input.page - 1) * 20}`,
        );
        type Product = {
          productId: string;
          name: string;
          unit: 'GRAM' | 'PIECE';
          quantity: bigint;
          revenue: bigint;
        };
        const products = await tx.$queryRaw<Product[]>(
          Prisma.sql`SELECT item->>'productId' AS "productId",(array_agg(item->>'name' ORDER BY o.created_at DESC,o.id))[1] AS name,CASE WHEN item->>'weightGrams' IS NULL THEN 'PIECE' ELSE 'GRAM' END AS unit,SUM((item->>'quantity')::bigint*COALESCE((item->>'weightGrams')::bigint,1))::bigint AS quantity,SUM((item->>'quantity')::bigint*(item->>'unitPrice')::bigint)::bigint AS revenue FROM (SELECT id,created_at,items FROM orders WHERE ${where} AND status='COMPLETED' AND payment_status='PAID') o CROSS JOIN LATERAL jsonb_array_elements(o.items) item GROUP BY 1,3 ORDER BY revenue DESC,"productId",unit LIMIT 10`,
        );
        return {
          orders: {
            items: rows.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
            page: input.page,
            pageSize: 20,
            total,
            totalPages: Math.max(1, Math.ceil(total / 20)),
          },
          summary: {
            orderCount: total,
            completedCount: reportNumber(sum!.completedCount),
            completedTotal: reportNumber(sum!.completedTotal),
            firstOrderAt: sum!.firstOrderAt?.toISOString() ?? null,
            lastOrderAt: sum!.lastOrderAt?.toISOString() ?? null,
            contact: contact ?? null,
          },
          products: products.map((x) => ({
            ...x,
            quantity: reportNumber(x.quantity),
            revenue: reportNumber(x.revenue),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10000 },
    );
  }
}
