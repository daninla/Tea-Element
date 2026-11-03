import type { AuthErrorCode } from '@tea/contracts';
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly statusCode = 401,
  ) {
    super(message);
  }
}
