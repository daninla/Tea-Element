import { Inject, Injectable } from '@nestjs/common';
import type { AdminOrderFilters } from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { OrderError } from '../../orders/domain/order-store';
import { view } from '../../orders/infrastructure/prisma-order-store';
import { AdminOrdersStore } from '../domain/admin-orders-store';
@Injectable()
export class PrismaAdminOrdersStore extends AdminOrdersStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async list(filters: AdminOrderFilters) {
    const q = filters.q?.trim().replace(/[\\%_]/g, '\\$&');
    const where: Prisma.OrderWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(filters.customerType
        ? { userId: filters.customerType === 'GUEST' ? null : { not: null } }
        : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lt: new Date(filters.to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: ['number', 'email', 'firstName', 'lastName', 'phone'].map((field) => ({
              [field]: { contains: q, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const pageSize = 20;
    return this.db.$transaction(
      async (tx) => {
        const total = await tx.order.count({ where });
        const rows = await tx.order.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (filters.page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true,
            paymentStatus: true,
            createdAt: true,
            userId: true,
          },
        });
        return {
          items: rows.map((row) => ({
            ...row,
            paymentMethod: row.paymentMethod as 'CASH_ON_DELIVERY' | 'ONLINE_CARD',
            createdAt: row.createdAt.toISOString(),
          })),
          page: filters.page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async detail(id: string) {
    const row = await this.db.order.findUnique({
      where: { id },
      include: { history: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!row) throw new OrderError('NOT_FOUND', 'Order not found', 404);
    return { ...view(row), userId: row.userId, comment: row.comment };
  }
}
