import { safeAccountNext, signupFields, profileFields } from './account-schema';
const signup = {
  email: 'buyer@example.test',
  password: 'test-password',
  confirmPassword: 'test-password',
  firstName: 'Tea',
  lastName: 'Buyer',
  phone: '',
  marketingConsent: false,
  acceptTerms: true,
};
it('rejects mismatched passwords and requires explicit terms acceptance', () => {
  expect(signupFields.safeParse(signup).success).toBe(true);
  expect(signupFields.safeParse({ ...signup, confirmPassword: 'other' }).success).toBe(false);
  expect(signupFields.safeParse({ ...signup, acceptTerms: false }).success).toBe(false);
});
it('allows only supported local return destinations', () => {
  expect(safeAccountNext('/checkout')).toBe('/checkout');
  expect(safeAccountNext('/admin/orders?status=PAID')).toBe('/admin/orders?status=PAID');
  expect(safeAccountNext('/admin/inventory?section=TEA')).toBe('/admin/inventory?section=TEA');
  expect(safeAccountNext('/admin/../../evil')).toBe('/account');
  for (const unsafe of [
    'https://example.com',
    '//example.com',
    '/account?next=//example.com',
    null,
  ])
    expect(safeAccountNext(unsafe)).toBe('/account');
});
it('requires a complete saved delivery address and rejects pickup', () => {
  const profile = {
    firstName: 'Tea',
    lastName: 'Buyer',
    phone: '',
    saveDelivery: true,
    delivery: { method: 'NOVA_POSHTA_BRANCH', city: '', address: '' },
  };
  expect(profileFields.safeParse(profile).success).toBe(false);
  expect(profileFields.safeParse({ ...profile, saveDelivery: false }).success).toBe(true);
  expect(
    profileFields.safeParse({ ...profile, delivery: { ...profile.delivery, method: 'PICKUP' } })
      .success,
  ).toBe(false);
});
