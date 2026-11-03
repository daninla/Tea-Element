import { Role, type AuthContext } from '@tea/contracts';
import {
  AuthStore,
  PasswordHasher,
  AccessTokenSigner,
  type AuthUser,
} from '../src/modules/auth/domain/auth-store';
export const context: AuthContext = { correlationId: 'unit-test' };
export const user: AuthUser = {
  id: '89993b68-b938-4dc2-a522-918cab61d563',
  email: 'buyer@example.test',
  firstName: 'Tea',
  lastName: 'Buyer',
  phone: null,
  role: Role.CUSTOMER,
  emailVerified: false,
  passwordHash: 'stored-hash',
  isActive: true,
};
export function dependencies() {
  const methods = {
    findByEmail: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user),
    register: jest.fn().mockResolvedValue(user),
    createSession: jest.fn().mockResolvedValue(undefined),
    rotate: jest.fn().mockResolvedValue({ kind: 'rotated', user }),
    revoke: jest.fn().mockResolvedValue(undefined),
  };
  const hash = jest.fn().mockResolvedValue('stored-hash');
  const verify = jest.fn().mockResolvedValue(true);
  const sign = jest.fn().mockResolvedValue('signed-access-token');
  return {
    store: methods as AuthStore,
    methods,
    passwords: { hash, verify } as PasswordHasher,
    signer: { sign } as AccessTokenSigner,
    hash,
    verify,
    sign,
  };
}
