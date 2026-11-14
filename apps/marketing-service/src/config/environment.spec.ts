import { readEnvironment } from './environment';
describe('environment', () => {
  it('keeps the local sender default and requires a sender address in production', () => {
    expect(readEnvironment({ NODE_ENV: 'test' }).SMTP_FROM_ADDRESS).toBe(
      'marketing@tea-element.test',
    );
    const production = {
      NODE_ENV: 'production',
      MARKETING_UNSUBSCRIBE_SECRET: 'fixture-only-secret-12345678901234567890',
    };
    expect(() => readEnvironment(production)).toThrow(/SMTP_FROM_ADDRESS/);
    expect(
      readEnvironment({ ...production, SMTP_FROM_ADDRESS: 'news@example.test' }).SMTP_FROM_ADDRESS,
    ).toBe('news@example.test');
  });
  it('rejects invalid ports instead of silently booting', () => {
    expect(() => readEnvironment({ NODE_ENV: 'test', PORT: 'not-a-port' })).toThrow();
    expect(() => readEnvironment({ NODE_ENV: 'test', PORT: '65536' })).toThrow();
  });
});
