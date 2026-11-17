import { paymentNoticeTemplate } from './payment-notice-template';
import type { PaymentNotice } from '../domain/payment-notice';
const notice = {
  id: 'notice',
  leaseId: 'lease',
  kind: 'RECEIVED',
  orderNumber: 'TE-demo',
  paymentId: 'attempt',
  email: 'demo@example.test',
  firstName: '<img src=x onerror=alert(1)>',
  amount: 101,
  currency: 'UAH',
  link: 'http://localhost/order/TE-demo?token=private&x="',
} satisfies PaymentNotice;
it('escapes HTML and formats integer kopecks without promising fulfillment', () => {
  const mail = paymentNoticeTemplate(notice);
  expect(mail.html).not.toContain('<img');
  expect(mail.html).toContain('&lt;img');
  expect(mail.html).toContain('private&amp;x=&quot;');
  expect(mail.text).toContain('1.01 UAH');
  expect(mail.subject).toContain('Оплату отримано');
  expect(mail.text).toContain('актуальний стан');
});
it('confirms only the refunded payment and makes the demo boundary explicit', () => {
  const mail = paymentNoticeTemplate({ ...notice, kind: 'REFUNDED', amount: 100 });
  expect(mail.subject).toContain('Повернення оплати підтверджено');
  expect(mail.text).toContain('1.00 UAH');
  expect(mail.text).toContain('залежить від банку');
  expect(mail.text).toContain('демонстраційний');
  expect(mail.text).toContain('attempt');
});
it('describes shipment without inventing a payment, tracking number or delivery date', () => {
  const mail = paymentNoticeTemplate({ ...notice, kind: 'SHIPPED', paymentId: null });
  expect(mail.subject).toContain('Замовлення відправлено');
  expect(mail.text).toContain('1.01 UAH');
  expect(mail.text).toContain(notice.link);
  expect(mail.text).not.toContain('Спроба оплати');
  expect(mail.html).not.toContain('Спроба оплати');
  expect(mail.html).not.toContain('null');
  expect(mail.text).toContain('Реальних платежів і відправлень не проводимо');
});
it('thanks the buyer on completion without claiming a second payment', () => {
  const mail = paymentNoticeTemplate({ ...notice, kind: 'COMPLETED', paymentId: null });
  expect(mail.subject).toContain('Замовлення завершено');
  expect(mail.text).toContain('Дякуємо за покупку');
  expect(mail.text).not.toContain('Оплату отримано');
  expect(mail.html).toContain('&lt;img');
  expect(mail.html).toContain('Перевірити замовлення');
});
it.each([
  [true, 'що оплату підтверджено'],
  [false, 'що товар зарезервовано'],
])(
  'sends the owner an admin link and the right shipping instruction (online=%s)',
  (online, instruction) => {
    const link = 'https://shop.example/admin/orders/order-id';
    const mail = paymentNoticeTemplate({
      id: notice.id,
      leaseId: notice.leaseId,
      orderNumber: notice.orderNumber,
      amount: notice.amount,
      currency: notice.currency,
      kind: 'OWNER_NEW_ORDER',
      email: 'owner@example.test',
      online,
      link,
    });
    expect(mail.subject).toBe('Нове замовлення · TE-demo');
    expect(mail.text).toContain(instruction);
    expect(mail.html).toContain(link);
    expect(mail.text).not.toContain('token=');
  },
);
