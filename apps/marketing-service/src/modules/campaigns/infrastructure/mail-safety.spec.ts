import { unsubscribeToken, validUnsubscribe } from './unsubscribe-token';
import { winBackMail } from './smtp-campaign-mailer';
it('renders a generic discount message with escaped title and both sale catalogs', () => {
  const mail = winBackMail({
    id: 'id',
    campaign: 'DISCOUNT',
    promotionTitle: '<script>sale</script>',
    email: 'demo@example.test',
    firstName: 'unused',
    catalogUrl: 'http://localhost/catalog',
    unsubscribeUrl: 'http://localhost/unsubscribe#token=proof',
  });
  expect(mail.html).not.toContain('<script>');
  expect(mail.html).toContain('&lt;script&gt;');
  for (const content of [mail.html, mail.text]) {
    expect(content).toContain('/catalog?onSale=true');
    expect(content).toContain('/teaware?onSale=true');
    expect(content).toContain('#token=proof');
  }
  expect(mail.text).not.toContain('unused');
});
it('binds unsubscribe proof to the profile, nonce and secret without throwing on Unicode tampering', () => {
  const id = 'a'.repeat(36),
    secret = 's'.repeat(48),
    token = unsubscribeToken(id, 'nonce', secret);
  expect(validUnsubscribe(token, id, 'nonce', secret)).toBe(true);
  for (const changed of [token + 'x', 'é'.repeat(token.length), token.slice(0, -1) + '!'])
    expect(validUnsubscribe(changed, id, 'nonce', secret)).toBe(false);
  expect(validUnsubscribe(token, id, 'different', secret)).toBe(false);
});
it('escapes recipient names and includes an unsubscribe link in both email parts', () => {
  const mail = winBackMail({
    id: 'id',
    email: 'demo@example.test',
    firstName: '<script>bad</script>',
    catalogUrl: 'http://localhost/catalog',
    unsubscribeUrl: 'http://localhost/unsubscribe#token=proof',
  });
  expect(mail.html).not.toContain('<script>');
  expect(mail.html).toContain('&lt;script&gt;');
  expect(mail.html).toContain('#token=proof');
  expect(mail.text).toContain('#token=proof');
  expect(mail.text).toContain('демонстраційний');
});
