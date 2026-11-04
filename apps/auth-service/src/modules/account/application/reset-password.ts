import { Inject, Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../auth/domain/auth-store';
import { AccountStore } from '../domain/account-store';
@Injectable()
export class ResetPassword {
  constructor(
    @Inject(AccountStore) private readonly store: AccountStore,
    @Inject(PasswordHasher) private readonly passwords: PasswordHasher,
  ) {}
  async execute(token: string, password: string, correlationId: string) {
    await this.store.confirm(
      'RESET_PASSWORD',
      token,
      correlationId,
      await this.passwords.hash(password),
    );
    return { reset: true as const };
  }
}
