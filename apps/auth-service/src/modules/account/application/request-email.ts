import { Inject, Injectable } from '@nestjs/common';
import { AccountStore } from '../domain/account-store';
import type { ChallengeKind } from '../domain/email-token';
@Injectable()
export class RequestEmail {
  constructor(@Inject(AccountStore) private readonly store: AccountStore) {}
  async execute(kind: ChallengeKind, identity: { userId?: string; email?: string }) {
    await this.store.request(kind, {
      ...identity,
      ...(identity.email ? { email: identity.email.trim().toLowerCase() } : {}),
    });
    return { accepted: true as const };
  }
}
