import { checkoutSchema } from './checkout-schema';
const fields = {
  firstName: 'Гість',
  lastName: 'Тест',
  phone: '+380501234567',
  email: 'test@example.test',
  delivery: { method: 'NOVA_POSHTA_BRANCH', city: 'Київ', address: 'Відділення 1' },
  paymentMethod: 'CASH_ON_DELIVERY',
  comment: '',
  acceptTerms: true,
  marketingConsent: false,
};
describe('guest checkout form', () => {
  it('accepts a manual Ukrposhta branch and preserves leading zeros', () => {
    const delivery = { method: 'UKRPOSHTA_BRANCH', city: ' Запоріжжя ', address: ' 00109 ' };
    expect(checkoutSchema.parse({ ...fields, delivery }).delivery).toEqual({
      ...delivery,
      city: 'Запоріжжя',
      address: '00109',
    });
  });
  it.each(['', '№19', '19a'])('rejects an invalid Ukrposhta branch number %j', (address) => {
    const delivery = { method: 'UKRPOSHTA_BRANCH', city: 'Запоріжжя', address };
    expect(checkoutSchema.safeParse({ ...fields, delivery }).success).toBe(false);
  });
  it('works without a user ID or marketing consent', () => {
    expect(checkoutSchema.safeParse(fields).success).toBe(true);
  });
  it('requires affirmative terms independently from marketing', () => {
    expect(
      checkoutSchema.safeParse({ ...fields, acceptTerms: false, marketingConsent: true }).success,
    ).toBe(false);
  });
  it.each(['NOVA_POSHTA_BRANCH', 'NOVA_POSHTA_COURIER'])(
    'requires city and address for %s',
    (method) => {
      expect(
        checkoutSchema.safeParse({ ...fields, delivery: { method, city: '', address: '' } })
          .success,
      ).toBe(false);
    },
  );
  it('does not accept pickup in new checkout orders', () => {
    expect(
      checkoutSchema.safeParse({ ...fields, delivery: { method: 'PICKUP', city: '', address: '' } })
        .success,
    ).toBe(false);
  });
  it.each([
    { phone: '0501234567' },
    { firstName: ' ' },
    { email: 'bad' },
    { paymentMethod: 'UNSUPPORTED' },
  ])('rejects invalid checkout values', (extra) => {
    expect(checkoutSchema.safeParse({ ...fields, ...extra }).success).toBe(false);
  });
});
