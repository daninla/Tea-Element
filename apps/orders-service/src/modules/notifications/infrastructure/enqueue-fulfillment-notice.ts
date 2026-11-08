import type { Prisma } from '../../../../generated/prisma';
export async function enqueueFulfillmentNotice(
  tx: Prisma.TransactionClient,
  order: { id: string; total: number },
  kind: 'SHIPPED' | 'COMPLETED',
) {
  const dedupeKey = `order:${order.id}:${kind}`;
  await tx.orderPaymentNotice.upsert({
    where: { dedupeKey },
    create: {
      dedupeKey,
      orderId: order.id,
      paymentId: null,
      kind,
      amount: order.total,
      currency: 'UAH',
    },
    update: {},
  });
}
