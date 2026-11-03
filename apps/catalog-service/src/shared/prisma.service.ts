import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { readEnvironment } from '../config/environment';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ datasources: { db: { url: readEnvironment().DATABASE_URL } } });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
