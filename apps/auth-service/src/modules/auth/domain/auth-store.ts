import type { AuthContext, PublicUser, UserRegistered } from '@tea/contracts';
export interface AuthUser extends PublicUser {
  passwordHash: string;
  isActive: boolean;
}
export interface NewSession {
  tokenHash: string;
  expiresAt: Date;
  familyId: string;
  context: AuthContext;
}
export interface NewUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  marketingConsent: boolean;
}
export type RotationResult = { kind: 'rotated'; user: AuthUser } | { kind: 'invalid' | 'replayed' };
export abstract class AuthStore {
  abstract findByEmail(email: string): Promise<AuthUser | null>;
  abstract findById(id: string): Promise<AuthUser | null>;
  abstract register(user: NewUser, session: NewSession, event: UserRegistered): Promise<AuthUser>;
  abstract createSession(userId: string, session: NewSession): Promise<void>;
  abstract rotate(tokenHash: string, replacement: NewSession, now: Date): Promise<RotationResult>;
  abstract revoke(tokenHash: string, now: Date): Promise<void>;
}
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(hash: string, password: string): Promise<boolean>;
}
export abstract class AccessTokenSigner {
  abstract sign(user: PublicUser): Promise<string>;
}
