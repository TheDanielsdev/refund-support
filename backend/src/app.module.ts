import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { RefundsModule } from './refunds/refunds.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, RefundsModule, OrdersModule],
})
export class AppModule { }




