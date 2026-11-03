import { Inject, Injectable } from '@nestjs/common';
import type { AuthRequest } from '@tea/contracts';
import { AuthStore } from '../domain/auth-store';
import { hashToken } from '../domain/session';
@Injectable()
export class Logout {
  constructor(@Inject(AuthStore) private readonly store: AuthStore) {}
  async execute({ input }: AuthRequest<{ token: string }>): Promise<{ loggedOut: true }> {
    if (input.token) await this.store.revoke(hashToken(input.token), new Date());
    return { loggedOut: true };
  }
}
