import type { PaymentNotice } from '../domain/payment-notice';
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]!,
  );
}
export function paymentNoticeTemplate(notice: PaymentNotice) {
  const title = {
    RECEIVED: 'Оплату отримано',
    REFUNDED: 'Повернення оплати підтверджено',
    SHIPPED: 'Замовлення відправлено',
    COMPLETED: 'Замовлення завершено',
  }[notice.kind];
  const amount = `${Math.floor(notice.amount / 100)}.${String(notice.amount % 100).padStart(2, '0')} ${notice.currency}`;
  const description = {
    REFUNDED:
      'Платіжний провайдер підтвердив повне повернення цієї оплати. Час відображення коштів залежить від банку.',
    RECEIVED:
      'Зафіксовано надходження онлайн-оплати. Це повідомлення про платіж; актуальний стан замовлення перевіряйте за приватним посиланням.',
    SHIPPED:
      'Статус замовлення змінено на «Відправлено». Перевіряйте актуальні відомості про замовлення та доставку за приватним посиланням.',
    COMPLETED:
      'Замовлення завершено. Дякуємо за покупку! Історію та склад замовлення можна переглянути за приватним посиланням.',
  }[notice.kind];
  const reference = notice.paymentId ? `\nСпроба оплати: ${notice.paymentId}` : '';
  const referenceHtml = notice.paymentId
    ? `<p style="overflow-wrap:anywhere"><strong>Спроба оплати:</strong> ${escape(notice.paymentId)}</p>`
    : '';
  const footer = 'Це демонстраційний магазин. Реальних платежів і відправлень не проводимо.';
  const text = `${notice.firstName}, вітаємо!\n${title}.\nЗамовлення: ${notice.orderNumber}\nСума: ${amount}${reference}\n${description}\nПеревірити замовлення: ${notice.link}\nПосилання приватне — не передавайте його іншим.\n${footer}`;
  const html = `<!doctype html><html lang="uk"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#faf8f3;color:#2b2b28;font:16px Arial,sans-serif"><main style="max-width:560px;margin:24px auto;padding:24px;background:#fff;overflow-wrap:anywhere;word-break:break-word"><p style="font-size:22px">Чайний елемент</p><h1 style="font-size:24px">${title}</h1><p>${escape(notice.firstName)}, вітаємо!</p><p>${escape(description)}</p><p><strong>Замовлення:</strong> ${escape(notice.orderNumber)}</p><p><strong>Сума:</strong> ${escape(amount)}</p>${referenceHtml}<p><a style="color:#355438" href="${escape(notice.link)}">Перевірити замовлення</a></p><p>Посилання приватне — не передавайте його іншим.</p><hr><p style="font-size:13px">${footer}</p></main></body></html>`;
  return { subject: `${title} · ${notice.orderNumber}`, text, html };
}
