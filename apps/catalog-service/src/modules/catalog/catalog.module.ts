import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { CatalogRepository } from './domain/catalog-repository';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog-repository';
import { ListCategories } from './application/list-categories';
import { ListProducts } from './application/list-products';
import { GetProduct } from './application/get-product';
import { CatalogRpcController } from './presentation/catalog-rpc.controller';
@Module({
  controllers: [CatalogRpcController],
  providers: [
    PrismaService,
    { provide: CatalogRepository, useClass: PrismaCatalogRepository },
    ListCategories,
    ListProducts,
    GetProduct,
  ],
})
export class CatalogModule {}
