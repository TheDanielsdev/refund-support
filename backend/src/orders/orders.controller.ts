import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Sample orders so testers know which email/order pairs to try. Synthetic data only. */
  @Get('orders/demo')
  async demo() {
    const orders = await this.prisma.order.findMany({
      orderBy: { orderNumber: 'asc' },
      include: { customer: true, items: true },
    });
    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      email: o.customer.email,
      customerName: o.customer.name,
      status: o.status,
      totalCents: o.totalCents,
      items: o.items.map((i) => ({ sku: i.sku, name: i.name, priceCents: i.priceCents, isFinalSale: i.isFinalSale })),
    }));
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
