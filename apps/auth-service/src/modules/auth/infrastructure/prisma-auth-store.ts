import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type User } from '../../../../generated/prisma';
import { Role, type UserRegistered } from '@tea/contracts';
import { PrismaService } from '../../../shared/prisma.service';
import {
  AuthStore,
  type AuthUser,
  type NewUser,
  type NewSession,
  type RotationResult,
} from '../domain/auth-store';
import { AuthError } from '../domain/auth-error';
function mapped(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role as Role,
    emailVerified: user.emailVerifiedAt !== null,
    passwordHash: user.passwordHash,
    isActive: user.isActive,
  };
}
function sessionData(session: NewSession) {
  return {
    tokenHash: session.tokenHash,
    familyId: session.familyId,
    expiresAt: session.expiresAt,
    userAgent: session.context.userAgent?.slice(0, 256),
    ip: session.context.ip?.slice(0, 64),
  };
}
@Injectable()
export class PrismaAuthStore extends AuthStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async findByEmail(email: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    return user ? mapped(user) : null;
  }
  async findById(id: string) {
    const user = await this.db.user.findUnique({ where: { id } });
    return user ? mapped(user) : null;
  }
  async register(input: NewUser, session: NewSession, event: UserRegistered) {
    try {
      return await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: event.payload.userId,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            passwordHash: input.passwordHash,
            phone: input.phone,
            marketingConsentAt: input.marketingConsent ? new Date() : null,
          },
        });
        await tx.refreshToken.create({ data: { ...sessionData(session), userId: user.id } });
        await tx.outbox.create({
          data: {
            id: event.eventId,
            eventName: event.name,
            correlationId: event.correlationId,
            payload: event as unknown as Prisma.InputJsonObject,
          },
        });
        return mapped(user);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AuthError('EMAIL_UNAVAILABLE', 'Email is unavailable', 409);
      throw error;
    }
  }
  async createSession(userId: string, session: NewSession) {
    await this.db.refreshToken.create({ data: { ...sessionData(session), userId } });
  }
  async rotate(tokenHash: string, replacement: NewSession, now: Date): Promise<RotationResult> {
    return this.db.$transaction(async (tx): Promise<RotationResult> => {
      // Lock the user, not just the token: every operation on a session family is serialized.
      await tx.$queryRaw`SELECT u.id FROM users u JOIN refresh_tokens r ON r.user_id = u.id WHERE r.token_hash = ${tokenHash} FOR UPDATE OF u`;
      const current = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!current) return { kind: 'invalid' };
      if (current.revokedAt) {
        await tx.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        // Return, do not throw: revocation must commit even though authentication fails.
        return { kind: 'replayed' };
      }
      if (current.expiresAt <= now || !current.user.isActive) return { kind: 'invalid' };
      await tx.refreshToken.update({ where: { id: current.id }, data: { revokedAt: now } });
      await tx.refreshToken.create({
        data: { ...sessionData(replacement), familyId: current.familyId, userId: current.userId },
      });
      return { kind: 'rotated', user: mapped(current.user) };
    });
  }
  async revoke(tokenHash: string, now: Date) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT u.id FROM users u JOIN refresh_tokens r ON r.user_id = u.id WHERE r.token_hash = ${tokenHash} FOR UPDATE OF u`;
      const current = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (current)
        await tx.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
    });
  }
}
