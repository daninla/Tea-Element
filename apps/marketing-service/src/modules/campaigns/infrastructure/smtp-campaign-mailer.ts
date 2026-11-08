import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { readEnvironment } from '../../../config/environment';
import { CampaignMailer, type CampaignMessage } from '../domain/campaign-store';
const escape = (x: string) =>
  x.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function winBackMail(m: CampaignMessage) {
  const subject = 'Час для нового чайного ритуалу · Чайний елемент';
  const text = `${m.firstName}, вітаємо!\nДавно не бачилися. Завітайте до каталогу та оберіть чай для наступного ритуалу: ${m.catalogUrl}\nВи отримали це маркетингове повідомлення, бо погодилися на розсилку.\nВідписатися одним натисканням: ${m.unsubscribeUrl}\nЦе демонстраційний магазин.`;
  const html = `<!doctype html><html lang="uk"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#faf8f3;font:16px Arial;color:#2b2b28"><main style="max-width:560px;margin:24px auto;padding:24px;background:white;overflow-wrap:anywhere;word-break:break-word"><p>Чайний елемент</p><h1>Час для нового чайного ритуалу</h1><p>${escape(m.firstName)}, вітаємо!</p><p>Давно не бачилися. Оберіть чай для наступного ритуалу.</p><p><a href="${escape(m.catalogUrl)}">Переглянути каталог</a></p><hr><p>Ви погодилися на маркетингову розсилку.</p><p><a href="${escape(m.unsubscribeUrl)}">Відписатися одним натисканням</a></p><p>Це демонстраційний магазин.</p></main></body></html>`;
  return { subject, text, html };
}
@Injectable()
export class SmtpCampaignMailer extends CampaignMailer implements OnModuleDestroy {
  private readonly transport = createTransport(readEnvironment().SMTP_URL, {
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });
  async send(message: CampaignMessage) {
    await this.transport.sendMail({
      from: 'Чайний елемент <marketing@tea-element.test>',
      to: message.email,
      messageId: `<campaign-${message.id}@tea-element.test>`,
      ...winBackMail(message),
    });
  }
  onModuleDestroy() {
    this.transport.close();
  }
}
