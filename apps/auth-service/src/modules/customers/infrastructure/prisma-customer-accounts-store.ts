import { Inject, Injectable } from '@nestjs/common';
import type { AccountCustomerQuery, CustomerAccount, CustomerAccountPage } from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { AuthError } from '../../auth/domain/auth-error';
import { CustomerAccountsStore } from '../domain/customer-accounts-store';
const select = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  emailVerifiedAt: true,
  marketingConsentAt: true,
  createdAt: true,
} as const;
const map = (x: Prisma.UserGetPayload<{ select: typeof select }>): CustomerAccount => ({
  ...x,
  emailVerifiedAt: x.emailVerifiedAt?.toISOString() ?? null,
  marketingConsentAt: x.marketingConsentAt?.toISOString() ?? null,
  createdAt: x.createdAt.toISOString(),
});
@Injectable()
export class PrismaCustomerAccountsStore extends CustomerAccountsStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  read(
    input: AccountCustomerQuery,
    actorId: string,
  ): Promise<CustomerAccount | CustomerAccountPage> {
    return this.db.$transaction(
      async (tx) => {
        if (
          !(await tx.user.findFirst({
            where: { id: actorId, role: 'ADMIN', isActive: true },
            select: { id: true },
          }))
        )
          throw new AuthError('FORBIDDEN', 'Administrator required', 403);
        if (input.kind === 'DETAIL') {
          const row = await tx.user.findFirst({
            where: { id: input.id, role: 'CUSTOMER' },
            select,
          });
          if (!row) throw new AuthError('USER_UNAVAILABLE', 'Customer not found', 404);
          return map(row);
        }
        const q = input.q?.trim().replace(/[\\%_]/g, '\\$&');
        const where: Prisma.UserWhereInput = {
          role: 'CUSTOMER',
          ...(q
            ? {
                OR: ['email', 'firstName', 'lastName', 'phone'].map((field) => ({
                  [field]: { contains: q, mode: 'insensitive' },
                })),
              }
            : {}),
        };
        const total = await tx.user.count({ where }),
          rows = await tx.user.findMany({
            where,
            select,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: 20,
            skip: (input.page - 1) * 20,
          });
        return {
          items: rows.map(map),
          page: input.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
