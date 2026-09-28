import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

type ItemSeed = { sku: string; name: string; priceCents: number; quantity?: number; isFinalSale?: boolean };
type OrderSeed = {
  orderNumber: string;
  status: OrderStatus;
  placedDaysAgo: number;
  deliveredDaysAgo?: number;
  items: ItemSeed[];
};
type CustomerSeed = { name: string; email: string; orders: OrderSeed[] };

// Each customer exercises a specific policy edge case (see docs/refund-policy.md).
const customers: CustomerSeed[] = [
  {
    // Happy path: recent, low-value, standard item
    name: 'Ada Okafor', email: 'ada.okafor@example.com',
    orders: [{ orderNumber: 'ORD-1001', status: 'DELIVERED', placedDaysAgo: 8, deliveredDaysAgo: 5,
      items: [{ sku: 'TSH-BLK-M', name: 'Black Cotton T-Shirt (M)', priceCents: 2500 }, { sku: 'CAP-NVY', name: 'Navy Cap', priceCents: 1800 }] }],
  },
  {
    // Final sale item
    name: 'Ben Carter', email: 'ben.carter@example.com',
    orders: [{ orderNumber: 'ORD-1002', status: 'DELIVERED', placedDaysAgo: 12, deliveredDaysAgo: 9,
      items: [{ sku: 'JKT-CLR-L', name: 'Clearance Winter Jacket (L)', priceCents: 6000, isFinalSale: true }] }],
  },
  {
    // Outside return window
    name: 'Chloe Nguyen', email: 'chloe.nguyen@example.com',
    orders: [{ orderNumber: 'ORD-1003', status: 'DELIVERED', placedDaysAgo: 95, deliveredDaysAgo: 90,
      items: [{ sku: 'BAG-TAN', name: 'Tan Leather Tote', priceCents: 12000 }] }],
  },
  {
    // High value: > $500 needs human review
    name: 'David Kim', email: 'david.kim@example.com',
    orders: [{ orderNumber: 'ORD-1004', status: 'DELIVERED', placedDaysAgo: 12, deliveredDaysAgo: 10,
      items: [{ sku: 'LAP-14', name: 'UltraBook 14" Laptop', priceCents: 120000 }] }],
  },
  {
    // Damaged item, low value, within window
    name: 'Emma Rossi', email: 'emma.rossi@example.com',
    orders: [{ orderNumber: 'ORD-1005', status: 'DELIVERED', placedDaysAgo: 6, deliveredDaysAgo: 4,
      items: [{ sku: 'HP-BT-01', name: 'Bluetooth Headphones', priceCents: 15000 }] }],
  },
  {
    // Wrong item received
    name: 'Farid Hassan', email: 'farid.hassan@example.com',
    orders: [{ orderNumber: 'ORD-1006', status: 'DELIVERED', placedDaysAgo: 10, deliveredDaysAgo: 7,
      items: [{ sku: 'SHO-RUN-42', name: 'Running Shoes (EU 42)', priceCents: 9000 }] }],
  },
  {
    // Suspicious: many refunds in short period
    name: 'Grace Liu', email: 'grace.liu@example.com',
    orders: [
      { orderNumber: 'ORD-1007', status: 'DELIVERED', placedDaysAgo: 5, deliveredDaysAgo: 3,
        items: [{ sku: 'WCH-SLV', name: 'Silver Wristwatch', priceCents: 22000 }] },
      { orderNumber: 'ORD-1007A', status: 'REFUNDED', placedDaysAgo: 20, deliveredDaysAgo: 18,
        items: [{ sku: 'SUN-01', name: 'Sunglasses', priceCents: 9000 }] },
      { orderNumber: 'ORD-1007B', status: 'REFUNDED', placedDaysAgo: 35, deliveredDaysAgo: 33,
        items: [{ sku: 'BLT-01', name: 'Leather Belt', priceCents: 4500 }] },
      { orderNumber: 'ORD-1007C', status: 'REFUNDED', placedDaysAgo: 50, deliveredDaysAgo: 48,
        items: [{ sku: 'WLT-01', name: 'Wallet', priceCents: 5500 }] },
    ],
  },
  {
    // Already refunded (duplicate request)
    name: 'Henry Adams', email: 'henry.adams@example.com',
    orders: [{ orderNumber: 'ORD-1008', status: 'REFUNDED', placedDaysAgo: 15, deliveredDaysAgo: 12,
      items: [{ sku: 'BLD-01', name: 'Kitchen Blender', priceCents: 7500 }] }],
  },
  {
    // Mixed order: final-sale + regular item
    name: 'Isabel Torres', email: 'isabel.torres@example.com',
    orders: [{ orderNumber: 'ORD-1009', status: 'DELIVERED', placedDaysAgo: 9, deliveredDaysAgo: 6,
      items: [
        { sku: 'DRS-RED-S', name: 'Red Summer Dress (S)', priceCents: 8000 },
        { sku: 'SCF-CLR', name: 'Clearance Scarf', priceCents: 2000, isFinalSale: true },
      ] }],
  },
  {
    // Threshold edge: just under and just over $500
    name: 'Jamal Wright', email: 'jamal.wright@example.com',
    orders: [
      { orderNumber: 'ORD-1010', status: 'DELIVERED', placedDaysAgo: 7, deliveredDaysAgo: 5,
        items: [{ sku: 'CHR-ERG', name: 'Ergonomic Chair', priceCents: 49999 }] },
      { orderNumber: 'ORD-1010B', status: 'DELIVERED', placedDaysAgo: 7, deliveredDaysAgo: 5,
        items: [{ sku: 'DSK-STD', name: 'Standing Desk', priceCents: 50001 }] },
    ],
  },
  {
    // Not yet delivered
    name: 'Kira Petrov', email: 'kira.petrov@example.com',
    orders: [{ orderNumber: 'ORD-1011', status: 'SHIPPED', placedDaysAgo: 3,
      items: [{ sku: 'BK-SET', name: 'Book Set (3 vols)', priceCents: 6000 }] }],
  },
  {
    // Window boundary: exactly 30 days since delivery
    name: "Liam O'Brien", email: 'liam.obrien@example.com',
    orders: [{ orderNumber: 'ORD-1012', status: 'DELIVERED', placedDaysAgo: 34, deliveredDaysAgo: 30,
      items: [{ sku: 'JNS-BLU-32', name: 'Blue Jeans (32)', priceCents: 7000 }] }],
  },
  {
    // High-value damaged item
    name: 'Mei Tanaka', email: 'mei.tanaka@example.com',
    orders: [{ orderNumber: 'ORD-1013', status: 'DELIVERED', placedDaysAgo: 5, deliveredDaysAgo: 3,
      items: [{ sku: 'JWL-NCK', name: 'Gold Pendant Necklace', priceCents: 85000 }] }],
  },
  {
    // Newer customer, expensive order, likely bad-faith claim scenarios
    name: 'Noah Williams', email: 'noah.williams@example.com',
    orders: [{ orderNumber: 'ORD-1014', status: 'DELIVERED', placedDaysAgo: 4, deliveredDaysAgo: 2,
      items: [{ sku: 'CAM-MIR', name: 'Mirrorless Camera', priceCents: 45000 }, { sku: 'LNS-50', name: '50mm Lens', priceCents: 15000 }] }],
  },
  {
    // Clean history, multiple orders
    name: 'Olivia Martins', email: 'olivia.martins@example.com',
    orders: [
      { orderNumber: 'ORD-1015', status: 'DELIVERED', placedDaysAgo: 14, deliveredDaysAgo: 11,
        items: [{ sku: 'MUG-01', name: 'Ceramic Mug Set', priceCents: 3200 }] },
      { orderNumber: 'ORD-1015B', status: 'DELIVERED', placedDaysAgo: 60, deliveredDaysAgo: 56,
        items: [{ sku: 'PLW-01', name: 'Memory Foam Pillow', priceCents: 4500 }] },
    ],
  },
];

async function main() {
  const existing = await prisma.customer.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} customers already present.`);
    return;
  }

  for (const c of customers) {
    await prisma.customer.create({
      data: {
        name: c.name,
        email: c.email,
        orders: {
          create: c.orders.map((o) => ({
            orderNumber: o.orderNumber,
            status: o.status,
            placedAt: daysAgo(o.placedDaysAgo),
            deliveredAt: o.deliveredDaysAgo !== undefined ? daysAgo(o.deliveredDaysAgo) : null,
            totalCents: o.items.reduce((s, i) => s + i.priceCents * (i.quantity ?? 1), 0),
            items: {
              create: o.items.map((i) => ({
                sku: i.sku,
                name: i.name,
                priceCents: i.priceCents,
                quantity: i.quantity ?? 1,
                isFinalSale: i.isFinalSale ?? false,
              })),
            },
          })),
        },
      },
    });
  }
  console.log(`Seeded ${customers.length} customers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
