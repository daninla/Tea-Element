import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { CatalogRequest, CatalogResult } from '@tea/contracts';
import { CatalogClient } from '../domain/catalog-client';
@Injectable()
export class RmqCatalogClient extends CatalogClient implements OnModuleDestroy {
  constructor(@Inject('CATALOG_TRANSPORT') private readonly client: ClientProxy) {
    super();
  }
  async request<T>(pattern: string, request: CatalogRequest<unknown>): Promise<CatalogResult<T>> {
    try {
      return await firstValueFrom(
        this.client
          .send<CatalogResult<T>, CatalogRequest<unknown>>(pattern, request)
          .pipe(timeout(8000)),
      );
    } catch {
      return {
        ok: false,
        error: {
          code: 'CATALOG_UNAVAILABLE',
          message: 'Catalog temporarily unavailable',
          statusCode: 503,
        },
      };
    }
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}
