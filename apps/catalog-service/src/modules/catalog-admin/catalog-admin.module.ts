import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { CatalogAdminStore, CatalogMediaStore } from './domain/catalog-admin-store';
import { PrismaCatalogAdminStore } from './infrastructure/prisma-catalog-admin-store';
import { FileCatalogMediaStore } from './infrastructure/file-catalog-media-store';
import { CatalogAdminRpcController } from './presentation/catalog-admin-rpc.controller';
import { ReadCatalogAdmin } from './application/read-catalog-admin';
import { WriteCatalogAdmin } from './application/write-catalog-admin';
import { UploadCatalogImage } from './application/upload-catalog-image';
import { ReadCatalogImage } from './application/read-catalog-image';
@Module({
  imports: [StockModule],
  controllers: [CatalogAdminRpcController],
  providers: [
    ReadCatalogAdmin,
    WriteCatalogAdmin,
    UploadCatalogImage,
    ReadCatalogImage,
    { provide: CatalogAdminStore, useClass: PrismaCatalogAdminStore },
    { provide: CatalogMediaStore, useClass: FileCatalogMediaStore },
  ],
})
export class CatalogAdminModule {}
