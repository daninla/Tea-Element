import type { PaymentOutcome } from '@tea/contracts';
import type { Prisma } from '../../../../generated/prisma';
export async function enqueuePaymentNotice(
  tx: Prisma.TransactionClient,
  event: PaymentOutcome,
  alreadyRefunded: boolean,
) {
  if (event.name !== 'PaymentSucceeded' && event.name !== 'PaymentRefunded') return;
  const { orderId, paymentId, amount, currency } = event.payload;
  if (
    event.name === 'PaymentSucceeded' &&
    (alreadyRefunded ||
      (await tx.orderPaymentNotice.findUnique({
        where: { paymentId_kind: { paymentId, kind: 'REFUNDED' } },
        select: { id: true },
      })))
  )
    return;
  const kind = event.name === 'PaymentSucceeded' ? 'RECEIVED' : 'REFUNDED';
  await tx.orderPaymentNotice.upsert({
    where: { paymentId_kind: { paymentId, kind } },
    create: { orderId, paymentId, amount, currency, kind },
    update: {},
  });
  if (kind === 'REFUNDED')
    await tx.orderPaymentNotice.updateMany({
      where: { paymentId, kind: 'RECEIVED', status: 'PENDING', leaseId: null },
      data: { status: 'SUPPRESSED' },
    });
}
