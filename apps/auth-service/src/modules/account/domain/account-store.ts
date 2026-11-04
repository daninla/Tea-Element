import type { PublicUser, ProfileInput, OrderView } from '@tea/contracts';
import type { ChallengeKind } from './email-token';
export abstract class AccountStore {
  abstract request(
    kind: ChallengeKind,
    identity: { userId?: string; email?: string },
  ): Promise<void>;
  abstract confirm(
    kind: ChallengeKind,
    token: string,
    correlationId: string,
    passwordHash?: string,
  ): Promise<void>;
  abstract profile(userId: string, input: ProfileInput): Promise<PublicUser>;
}
export abstract class RegistrationOrderAccess {
  abstract get(number: string, token: string, correlationId: string): Promise<OrderView>;
}
