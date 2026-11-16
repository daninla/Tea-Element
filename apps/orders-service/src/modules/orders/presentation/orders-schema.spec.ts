import { cartItems, createInput, access } from './orders-schema';
const id = '00000000-0000-4000-8000-000000000001';
const input = {
  items: [{ variantId: id, quantity: 1 }],
  firstName: ' Test ',
  lastName: ' Guest ',
  phone: '+380501234567',
  email: 'DEMO@example.test',
  delivery: { method: 'NOVA_POSHTA_BRANCH', city: 'Київ', address: 'Відділення 1' },
  paymentMethod: 'CASH_ON_DELIVERY',
  marketingConsent: false,
  acceptTerms: true,
};
describe('order boundary validation', () => {
  it('accepts a manual Ukrposhta branch and preserves leading zeros', () => {
    const delivery = { method: 'UKRPOSHTA_BRANCH', city: ' Запоріжжя ', address: ' 00109 ' };
    expect(createInput.parse({ ...input, delivery }).delivery).toEqual({
      ...delivery,
      city: 'Запоріжжя',
      address: '00109',
    });
  });
  it.each(['', '№19', '19a'])('rejects an invalid Ukrposhta branch number %j', (address) => {
    const delivery = { method: 'UKRPOSHTA_BRANCH', city: 'Запоріжжя', address };
    expect(createInput.safeParse({ ...input, delivery }).success).toBe(false);
  });
  it('normalizes contacts without requiring an account', () => {
    expect(createInput.parse(input)).toMatchObject({
      firstName: 'Test',
      email: 'demo@example.test',
      marketingConsent: false,
    });
  });
  it.each([{ total: 1 }, { userId: id }, { accessToken: 'chosen' }])(
    'rejects untrusted extra fields',
    (extra) => expect(createInput.safeParse({ ...input, ...extra }).success).toBe(false),
  );
  it('rejects duplicate variants and excess quantities', () => {
    expect(cartItems.safeParse([...input.items, ...input.items]).success).toBe(false);
    expect(cartItems.safeParse([{ variantId: id, quantity: 100 }]).success).toBe(false);
  });
  it('requires contact, delivery and affirmative terms', () => {
    for (const extra of [
      { acceptTerms: false },
      { phone: '123' },
      { firstName: ' ' },
      { delivery: { method: 'NOVA_POSHTA_BRANCH', city: '', address: '' } },
      { paymentMethod: 'UNSUPPORTED' },
    ])
      expect(createInput.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it('allows server-calculated online orders without an account', () => {
    expect(createInput.parse({ ...input, paymentMethod: 'ONLINE_CARD' }).paymentMethod).toBe(
      'ONLINE_CARD',
    );
  });
  it('does not accept arbitrary tokens or order numbers', () => {
    expect(access.safeParse({ number: '123', token: 'bad' }).success).toBe(false);
  });
});
