import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import {
  CATALOG_PATTERNS,
  type CategoryView,
  type ProductPage,
  type ProductView,
} from '@tea/contracts';
import { Public, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
import { ForwardCatalog } from '../application/forward-catalog';
import { CatalogQueryDto, ProductSlugDto } from './catalog-query.dto';
@ApiTags('Catalog')
@Public()
@Throttle({ default: { limit: 120, ttl: 60000 } })
@Controller('api/v1')
export class CatalogController {
  constructor(@Inject(ForwardCatalog) private readonly catalog: ForwardCatalog) {}
  @Get('categories')
  categories(@Req() request: AuthenticatedRequest) {
    return this.catalog.execute<CategoryView[]>(CATALOG_PATTERNS.categories, {
      input: {},
      context: { correlationId: String(request.id) },
    });
  }
  @Get('products')
  products(@Query() input: CatalogQueryDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.execute<ProductPage>(CATALOG_PATTERNS.products, {
      input,
      context: { correlationId: String(request.id) },
    });
  }
  @Get('products/:slug')
  product(@Param() input: ProductSlugDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.execute<ProductView>(CATALOG_PATTERNS.product, {
      input,
      context: { correlationId: String(request.id) },
    });
  }
}
