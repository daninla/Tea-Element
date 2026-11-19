import {
  Body,
  Controller,
  Get,
  HttpCode,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ORDERS_PATTERNS,
  type CartQuote,
  type CreatedOrder,
  type OrderView,
  type OrderPageView,
  type CartItemInput,
} from '@tea/contracts';
import {
  Public,
  OptionalAuth,
  type AuthenticatedRequest,
} from '../../auth/presentation/auth-policy';
import { OrdersClient } from '../domain/orders-client';
import {
  OrderLookupDto,
  OrderListDto,
  PaymentCommandDto,
  CartDto,
  CreateOrderDto,
  OrderNumberDto,
  OrderTokenDto,
} from './orders.dto';
@Controller('api/v1/orders')
export class OrdersController {
  constructor(@Inject(OrdersClient) private readonly orders: OrdersClient) {}
  @Get() list(@Query() q: OrderListDto, @Req() req: AuthenticatedRequest) {
    return this.orders.request<OrderPageView>(ORDERS_PATTERNS.list, {
      input: { page: q.page ?? 1 },
      context: { correlationId: String(req.id), userId: req.user!.sub },
    });
  }
  @Public() @Post('lookup') @HttpCode(200) @Throttle({ default: { limit: 3, ttl: 60000 } }) lookup(
    @Body() input: OrderLookupDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.request<{ accepted: true }>(ORDERS_PATTERNS.lookup, {
      input,
      context: { correlationId: String(req.id) },
    });
  }
  @Public()
  @Post('delivery')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  checkoutDelivery(@Body() input: unknown, @Req() req: AuthenticatedRequest) {
    return this.orders.request(ORDERS_PATTERNS.delivery, {
      input,
      context: { correlationId: String(req.id) },
    });
  }
  @Public()
  @Post('guest')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  guest(
    @Body() order: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.request<CreatedOrder>(ORDERS_PATTERNS.create, {
      input: { order, idempotencyKey },
      context: { correlationId: String(req.id) },
    });
  }
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Body() order: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.request<CreatedOrder>(ORDERS_PATTERNS.create, {
      input: { order, idempotencyKey },
      context: { correlationId: String(req.id), userId: req.user!.sub },
    });
  }
  @Public()
  @OptionalAuth()
  @Get(':number')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  get(
    @Param() param: OrderNumberDto,
    @Query() query: OrderTokenDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.request<OrderView>(ORDERS_PATTERNS.get, {
      input: { ...param, ...query },
      context: { correlationId: String(req.id), userId: req.user?.sub },
    });
  }
  @Public()
  @OptionalAuth()
  @HttpCode(200)
  @Post(':number/payment/:action')
  changePayment(
    @Param() param: PaymentCommandDto,
    @Query() query: OrderTokenDto,
    @Headers('idempotency-key') key: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.request<OrderView>(ORDERS_PATTERNS.changePayment, {
      input: {
        number: param.number,
        ...query,
        action: param.action === 'retry' ? 'RETRY' : 'COD',
        key,
      },
      context: { correlationId: String(req.id), userId: req.user?.sub },
    });
  }
  @Public()
  @OptionalAuth()
  @HttpCode(200)
  @Post(':number/cancel')
  cancel(
    @Param() param: OrderNumberDto,
    @Query() query: OrderTokenDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.request<OrderView>(ORDERS_PATTERNS.cancel, {
      input: { ...param, ...query },
      context: { correlationId: String(req.id), userId: req.user?.sub },
    });
  }
}
@Controller('api/v1/cart')
export class CartController {
  constructor(@Inject(OrdersClient) private readonly orders: OrdersClient) {}
  @Public()
  @HttpCode(200)
  @Post('quote')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  quote(@Body() input: CartDto, @Req() req: AuthenticatedRequest) {
    return this.orders.request<CartQuote>(ORDERS_PATTERNS.quote, {
      input,
      context: { correlationId: String(req.id) },
    });
  }
  @Get() get(@Req() req: AuthenticatedRequest) {
    return this.orders.request<CartItemInput[]>(ORDERS_PATTERNS.cart, {
      input: {},
      context: { correlationId: String(req.id), userId: req.user!.sub },
    });
  }
  @Put() save(@Body() input: CartDto, @Req() req: AuthenticatedRequest) {
    return this.orders.request<CartItemInput[]>(ORDERS_PATTERNS.saveCart, {
      input,
      context: { correlationId: String(req.id), userId: req.user!.sub },
    });
  }
  @HttpCode(200)
  @Post('merge')
  merge(
    @Body() input: CartDto,
    @Headers('idempotency-key') mergeKey: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.request<CartItemInput[]>(ORDERS_PATTERNS.mergeCart, {
      input: { ...input, mergeKey },
      context: { correlationId: String(req.id), userId: req.user!.sub },
    });
  }
}
