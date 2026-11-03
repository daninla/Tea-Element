import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasher } from '../domain/auth-store';
@Injectable()
export class ArgonPasswordHasher extends PasswordHasher {
  hash(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }
  async verify(hash: string, password: string) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
