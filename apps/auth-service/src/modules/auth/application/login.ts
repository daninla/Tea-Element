import { Inject, Injectable } from '@nestjs/common';
import type { AuthRequest, AuthSession, LoginInput } from '@tea/contracts';
import { AuthStore, PasswordHasher, AccessTokenSigner } from '../domain/auth-store';
import { AuthError } from '../domain/auth-error';
import { newSession, publicUser } from '../domain/session';
@Injectable()
export class Login {
  private dummyHash?: Promise<string>;
  constructor(
    @Inject(AuthStore) private readonly store: AuthStore,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
    @Inject(AccessTokenSigner) private readonly signer: AccessTokenSigner,
  ) {}
  async execute({ input, context }: AuthRequest<LoginInput>): Promise<AuthSession> {
    const user = await this.store.findByEmail(input.email.toLowerCase().trim());
    this.dummyHash ??= this.passwords.hash('invalid-account-timing-padding');
    const valid = await this.passwords.verify(
      user?.passwordHash ?? (await this.dummyHash),
      input.password,
    );
    if (!user || !valid || !user.isActive)
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    const session = newSession(context);
    await this.store.createSession(user.id, session.record);
    return {
      user: publicUser(user),
      accessToken: await this.signer.sign(user),
      refreshToken: session.token,
    };
  }
}
