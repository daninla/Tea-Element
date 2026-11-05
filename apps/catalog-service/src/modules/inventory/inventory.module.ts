import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { InventoryStore } from './domain/inventory-store';
import { PrismaInventoryStore } from './infrastructure/prisma-inventory-store';
import { InventoryRpcController } from './presentation/inventory-rpc.controller';
import { ListInventory } from './application/list-inventory';
import { GetInventory } from './application/get-inventory';
import { ReadInventoryHistory } from './application/read-inventory-history';
import { RecordPurchase } from './application/record-purchase';
import { AdjustInventory } from './application/adjust-inventory';
@Module({
  imports: [StockModule],
  controllers: [InventoryRpcController],
  providers: [
    ListInventory,
    GetInventory,
    ReadInventoryHistory,
    RecordPurchase,
    AdjustInventory,
    { provide: InventoryStore, useClass: PrismaInventoryStore },
  ],
})
export class InventoryModule {}
