import type { AuthRequest, RpcResult } from '@tea/contracts';
export abstract class AuthClient {
  abstract request<T>(pattern: string, request: AuthRequest<unknown>): Promise<RpcResult<T>>;
}
