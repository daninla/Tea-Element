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
} as PaymentNotice;
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
