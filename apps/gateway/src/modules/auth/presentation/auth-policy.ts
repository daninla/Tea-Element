import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessClaims, Role } from '@tea/contracts';
export const PUBLIC = 'tea.public';
export const ROLES = 'tea.roles';
export const Public = () => SetMetadata(PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
export interface AuthenticatedRequest extends Request {
  user?: AccessClaims;
}
export function cookie(request: Request, name: string): string {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length <= 2048 ? value : '';
}
