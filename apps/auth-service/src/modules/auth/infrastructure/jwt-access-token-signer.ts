import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PublicUser } from '@tea/contracts';
import { AccessTokenSigner } from '../domain/auth-store';
import { readEnvironment } from '../../../config/environment';
@Injectable()
export class JwtAccessTokenSigner extends AccessTokenSigner {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {
    super();
  }
  sign(user: PublicUser) {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: readEnvironment().JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: 'tea-auth',
        audience: 'tea-gateway',
      },
    );
  }
}
