import {
  CatalogAdminController,
  CatalogMediaController,
} from './presentation/catalog-admin.controller';
import { InventoryController } from './presentation/inventory.controller';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { CatalogClient } from './domain/catalog-client';
import { RmqCatalogClient } from './infrastructure/rmq-catalog-client';
import { ForwardCatalog } from './application/forward-catalog';
import { CatalogController } from './presentation/catalog.controller';
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'CATALOG_TRANSPORT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [readEnvironment().RABBITMQ_URL],
            queue: readEnvironment().CATALOG_RPC_QUEUE,
            queueOptions: { durable: true, messageTtl: 6000 },
            persistent: false,
          },
        }),
      },
    ]),
  ],
  controllers: [
    CatalogController,
    InventoryController,
    CatalogAdminController,
    CatalogMediaController,
  ],
  exports: [ForwardCatalog],
  providers: [ForwardCatalog, { provide: CatalogClient, useClass: RmqCatalogClient }],
})
export class CatalogModule {}
