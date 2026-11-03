import { Inject, Injectable } from '@nestjs/common';
import type { AuthRequest, AuthSession } from '@tea/contracts';
import { AuthStore, AccessTokenSigner } from '../domain/auth-store';
import { AuthError } from '../domain/auth-error';
import { hashToken, newSession, publicUser } from '../domain/session';
@Injectable()
export class Refresh {
  constructor(
    @Inject(AuthStore) private readonly store: AuthStore,
    @Inject(AccessTokenSigner) private readonly signer: AccessTokenSigner,
  ) {}
  async execute({ input, context }: AuthRequest<{ token: string }>): Promise<AuthSession> {
    const session = newSession(context);
    const result = await this.store.rotate(hashToken(input.token), session.record, new Date());
    if (result.kind !== 'rotated')
      throw new AuthError('INVALID_SESSION', 'Session expired or revoked');
    return {
      user: publicUser(result.user),
      accessToken: await this.signer.sign(result.user),
      refreshToken: session.token,
    };
  }
}
