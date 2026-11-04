import { Inject, Injectable } from '@nestjs/common';
import type { ProfileInput } from '@tea/contracts';
import { AccountStore } from '../domain/account-store';
@Injectable()
export class UpdateProfile {
  constructor(@Inject(AccountStore) private readonly store: AccountStore) {}
  execute(userId: string, input: ProfileInput) {
    return this.store.profile(userId, input);
  }
}
