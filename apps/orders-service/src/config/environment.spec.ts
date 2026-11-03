import { readEnvironment } from './environment';
describe('environment', () => {
  it('rejects invalid ports instead of silently booting', () => {
    expect(() => readEnvironment({ PORT: 'not-a-port' })).toThrow();
    expect(() => readEnvironment({ PORT: '65536' })).toThrow();
  });
});
