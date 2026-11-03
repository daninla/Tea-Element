import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { OutboxPublisher } from '../../shared/outbox/outbox-publisher';
import { RabbitEventBus } from '../../shared/outbox/rabbit-event-bus';
import { StockStore } from './domain/stock-store';
import { PrismaStockStore } from './infrastructure/prisma-stock-store';
import { QuoteCart } from './application/quote-cart';
import { HandleStockEvent } from './application/handle-stock-event';
import { StockWorker } from './presentation/stock-worker';
import { StockRpcController } from './presentation/stock-rpc.controller';
@Module({
  controllers: [StockRpcController],
  providers: [
    PrismaService,
    RabbitEventBus,
    OutboxPublisher,
    { provide: StockStore, useClass: PrismaStockStore },
    QuoteCart,
    HandleStockEvent,
    StockWorker,
  ],
})
export class StockModule {}
