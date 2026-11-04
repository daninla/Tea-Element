import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ProfileInput, PublicUser, UserEmailVerified } from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { AuthError } from '../../auth/domain/auth-error';
import { AccountStore } from '../domain/account-store';
import {
  newEmailChallenge,
  challengeId,
  matchesEmailToken,
  type ChallengeKind,
} from '../domain/email-token';
@Injectable()
export class PrismaAccountStore extends AccountStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async request(kind: ChallengeKind, identity: { userId?: string; email?: string }) {
    await this.db.$transaction(async (tx) => {
      const user = identity.userId
        ? await tx.user.findUnique({ where: { id: identity.userId } })
        : await tx.user.findUnique({ where: { email: identity.email! } });
      if (!user || !user.isActive) return;
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
      const recent = await tx.emailChallenge.findFirst({
        where: {
          userId: user.id,
          kind,
          usedAt: null,
          expiresAt: { gt: new Date() },
          createdAt: { gt: new Date(Date.now() - 60000) },
        },
      });
      if (recent) return;
      await tx.emailChallenge.updateMany({
        where: { userId: user.id, kind, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.emailChallenge.create({
        data: newEmailChallenge(user.id, kind, readEnvironment().JWT_ACCESS_SECRET),
      });
    });
  }
  async confirm(kind: ChallengeKind, token: string, correlationId: string, passwordHash?: string) {
    const id = challengeId(token);
    if (!id) throw new AuthError('INVALID_INPUT', 'Invalid or expired link', 400);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT u.id FROM users u JOIN email_challenges c ON c.user_id=u.id WHERE c.id=${id}::uuid FOR UPDATE OF u`;
      const row = await tx.emailChallenge.findUnique({ where: { id }, include: { user: true } });
      if (
        !row ||
        row.kind !== kind ||
        !row.user.isActive ||
        row.usedAt ||
        row.expiresAt <= new Date() ||
        !matchesEmailToken(token, row.tokenHash)
      )
        throw new AuthError('INVALID_INPUT', 'Invalid or expired link', 400);
      const now = new Date();
      await tx.emailChallenge.update({ where: { id }, data: { usedAt: now } });
      if (kind === 'RESET_PASSWORD') {
        if (!passwordHash) throw new AuthError('INVALID_INPUT', 'Password required', 400);
        await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
        await tx.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.emailChallenge.updateMany({
          where: { userId: row.userId, kind, usedAt: null },
          data: { usedAt: now },
        });
      } else {
        await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: now } });
        const event: UserEmailVerified = {
          eventId: randomUUID(),
          name: 'UserEmailVerified',
          version: 1,
          occurredAt: now.toISOString(),
          correlationId,
          payload: { userId: row.userId, email: row.user.email },
        };
        await tx.outbox.create({
          data: {
            id: event.eventId,
            eventName: event.name,
            correlationId,
            payload: event as unknown as Prisma.InputJsonObject,
          },
        });
      }
    });
  }
  async profile(userId: string, input: ProfileInput): Promise<PublicUser> {
    const row = await this.db.user.findUnique({ where: { id: userId } });
    if (!row?.isActive) throw new AuthError('USER_UNAVAILABLE', 'User unavailable');
    const saved = await this.db.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        defaultDelivery: input.defaultDelivery
          ? (input.defaultDelivery as unknown as Prisma.InputJsonObject)
          : Prisma.DbNull,
      },
    });
    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      phone: saved.phone,
      role: saved.role as PublicUser['role'],
      emailVerified: !!saved.emailVerifiedAt,
      defaultDelivery: input.defaultDelivery,
    };
  }
}
