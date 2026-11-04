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
  type CartItemInput,
} from '@tea/contracts';
import {
  Public,
  OptionalAuth,
  type AuthenticatedRequest,
} from '../../auth/presentation/auth-policy';
import { ForwardOrders } from '../application/forward-orders';
import {
  PaymentCommandDto,
  CartDto,
  CreateOrderDto,
  OrderNumberDto,
  OrderTokenDto,
} from './orders.dto';
@Controller('api/v1/orders')
export class OrdersController {
  constructor(@Inject(ForwardOrders) private readonly orders: ForwardOrders) {}
  @Public()
  @Post('guest')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  guest(
    @Body() order: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orders.execute<CreatedOrder>(ORDERS_PATTERNS.create, {
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
    return this.orders.execute<CreatedOrder>(ORDERS_PATTERNS.create, {
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
    return this.orders.execute<OrderView>(ORDERS_PATTERNS.get, {
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
    return this.orders.execute<OrderView>(ORDERS_PATTERNS.changePayment, {
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
    return this.orders.execute<OrderView>(ORDERS_PATTERNS.cancel, {
      input: { ...param, ...query },
      context: { correlationId: String(req.id), userId: req.user?.sub },
    });
  }
}
@Controller('api/v1/cart')
export class CartController {
  constructor(@Inject(ForwardOrders) private readonly orders: ForwardOrders) {}
  @Public()
  @HttpCode(200)
  @Post('quote')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  quote(@Body() input: CartDto, @Req() req: AuthenticatedRequest) {
    return this.orders.execute<CartQuote>(ORDERS_PATTERNS.quote, {
      input,
      context: { correlationId: String(req.id) },
    });
  }
  @Get() get(@Req() req: AuthenticatedRequest) {
    return this.orders.execute<CartItemInput[]>(ORDERS_PATTERNS.cart, {
      input: {},
      context: { correlationId: String(req.id), userId: req.user!.sub },
    });
  }
  @Put() save(@Body() input: CartDto, @Req() req: AuthenticatedRequest) {
    return this.orders.execute<CartItemInput[]>(ORDERS_PATTERNS.saveCart, {
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
    return this.orders.execute<CartItemInput[]>(ORDERS_PATTERNS.mergeCart, {
      input: { ...input, mergeKey },
      context: { correlationId: String(req.id), userId: req.user!.sub },
    });
  }
}
