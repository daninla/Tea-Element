import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  Role,
  type AuthRequest,
  type AuthSession,
  type RegisterInput,
  type UserRegistered,
} from '@tea/contracts';
import { AuthStore, PasswordHasher, AccessTokenSigner } from '../domain/auth-store';
import { newSession, publicUser } from '../domain/session';
@Injectable()
export class Register {
  constructor(
    @Inject(AuthStore) private readonly store: AuthStore,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
    @Inject(AccessTokenSigner) private readonly signer: AccessTokenSigner,
  ) {}
  async execute({ input, context }: AuthRequest<RegisterInput>): Promise<AuthSession> {
    const session = newSession(context);
    const userId = randomUUID();
    const event: UserRegistered = {
      eventId: randomUUID(),
      name: 'UserRegistered',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId,
      payload: {
        userId,
        email: input.email.toLowerCase().trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        marketingConsent: input.marketingConsent ?? false,
      },
    };
    const user = await this.store.register(
      {
        ...event.payload,
        passwordHash: await this.passwords.hash(input.password),
        phone: input.phone,
      },
      session.record,
      event,
    );
    // The store always assigns CUSTOMER; a role is never accepted from registration input.
    if (user.role !== Role.CUSTOMER) throw new Error('Invalid registration role');
    return {
      user: publicUser(user),
      accessToken: await this.signer.sign(user),
      refreshToken: session.token,
    };
  }
}
