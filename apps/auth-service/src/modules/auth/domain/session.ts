import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthContext, PublicUser } from '@tea/contracts';
import type { AuthUser, NewSession } from './auth-store';
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function newSession(context: AuthContext): { token: string; record: NewSession } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    record: {
      tokenHash: hashToken(token),
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      context,
    },
  };
}
export function publicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    ...(user.defaultDelivery !== undefined ? { defaultDelivery: user.defaultDelivery } : {}),
  };
}
