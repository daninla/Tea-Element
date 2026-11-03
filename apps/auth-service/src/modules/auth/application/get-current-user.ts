import { Inject, Injectable } from '@nestjs/common';
import type { AuthRequest, PublicUser } from '@tea/contracts';
import { AuthStore } from '../domain/auth-store';
import { AuthError } from '../domain/auth-error';
import { publicUser } from '../domain/session';
@Injectable()
export class GetCurrentUser {
  constructor(@Inject(AuthStore) private readonly store: AuthStore) {}
  async execute({ input }: AuthRequest<{ userId: string }>): Promise<PublicUser> {
    const user = await this.store.findById(input.userId);
    if (!user || !user.isActive) throw new AuthError('USER_UNAVAILABLE', 'User unavailable');
    return publicUser(user);
  }
}
