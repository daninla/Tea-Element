import { formatMoney } from './utils';
describe('stable hryvnia formatting', () => {
  it.each([
    [0, '0\u00a0₴'],
    [7500, '75\u00a0₴'],
    [12150, '121,50\u00a0₴'],
    [100001, '1\u00a0000,01\u00a0₴'],
  ])('formats %s without server/browser ICU currency differences', (amount, expected) => {
    expect(formatMoney(amount as number)).toBe(expected);
  });
  it.each([-1, 1.5, Infinity])('rejects invalid display amounts %s', (amount) => {
    expect(() => formatMoney(amount)).toThrow();
  });
});
