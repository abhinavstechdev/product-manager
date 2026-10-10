import { getDb } from "../db/client";
import { orders, orderItems, products, payments, inventoryTransactions, categories } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function getSalesReport(workspaceId: string, options?: { startDate?: string; endDate?: string }) {
  const db = await getDb();

  const allOrders = await (db as any)
    .select()
    .from(orders)
    .where(eq(orders.workspaceId, workspaceId))
    .orderBy(desc(orders.createdAt));

  let filtered = allOrders;
  if (options?.startDate) {
    const start = new Date(options.startDate);
    filtered = filtered.filter((o: any) => new Date(o.createdAt) >= start);
  }
  if (options?.endDate) {
    const end = new Date(options.endDate);
    filtered = filtered.filter((o: any) => new Date(o.createdAt) <= end);
  }

  // Calculate gross, discounts, shipping, net order value
  let totalGrossOrderValue = 0;
  let totalDiscounts = 0;
  let totalShippingFees = 0;
  let totalNetRevenue = 0;
  let deliveredRevenue = 0;
  let orderCount = filtered.length;

  for (const o of filtered) {
    const sub = parseFloat(o.subtotal);
    const disc = parseFloat(o.discount);
    const ship = parseFloat(o.shippingFee);
    const tot = parseFloat(o.totalAmount);

    totalGrossOrderValue += sub;
    totalDiscounts += disc;
    totalShippingFees += ship;
    totalNetRevenue += tot;

    if (o.status === "DELIVERED") {
      deliveredRevenue += tot;
    }
  }

  return {
    orderCount,
    totalGrossOrderValue: Math.round(totalGrossOrderValue * 100) / 100,
    totalDiscounts: Math.round(totalDiscounts * 100) / 100,
    totalShippingFees: Math.round(totalShippingFees * 100) / 100,
    totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
    deliveredRevenue: Math.round(deliveredRevenue * 100) / 100,
  };
}

export async function getBestSellingProducts(workspaceId: string, limit: number = 10) {
  const db = await getDb();

  const items = await (db as any)
    .select({
      productId: orderItems.productId,
      sku: orderItems.sku,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      totalPrice: orderItems.totalPrice,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orders.workspaceId, workspaceId));

  const statsMap: Record<string, { sku: string; name: string; totalQty: number; totalRevenue: number }> = {};

  for (const it of items) {
    if (!statsMap[it.productId]) {
      statsMap[it.productId] = {
        sku: it.sku,
        name: it.productName,
        totalQty: 0,
        totalRevenue: 0,
      };
    }
    statsMap[it.productId].totalQty += it.quantity;
    statsMap[it.productId].totalRevenue += parseFloat(it.totalPrice);
  }

  const sorted = Object.values(statsMap).sort((a, b) => b.totalQty - a.totalQty);
  return sorted.slice(0, limit);
}

export async function getDashboardOverview(workspaceId: string) {
  const db = await getDb();

  // 1. Products stats
  const allProducts = await (db as any)
    .select()
    .from(products)
    .where(eq(products.workspaceId, workspaceId));

  let physicalStock = 0;
  let reservedStock = 0;
  let availableStock = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;
  let inventoryValuation = 0;

  for (const p of allProducts) {
    physicalStock += p.physicalStock;
    reservedStock += p.reservedStock;
    const avail = p.physicalStock - p.reservedStock;
    availableStock += avail;
    if (avail <= 0) outOfStockProducts++;
    else if (avail <= p.reorderThreshold) lowStockProducts++;
    inventoryValuation += parseFloat(p.purchaseCost) * p.physicalStock;
  }

  // 2. Orders stats
  const allOrders = await (db as any)
    .select()
    .from(orders)
    .where(eq(orders.workspaceId, workspaceId));

  let totalOrders = allOrders.length;
  let newOrders = 0;
  let ordersToPack = 0;
  let packedOrders = 0;
  let shippedOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  let unpaidOrders = 0;
  let totalOrderValue = 0;

  for (const o of allOrders) {
    totalOrderValue += parseFloat(o.totalAmount);
    if (o.status === "NEW") newOrders++;
    else if (o.status === "CONFIRMED" || o.status === "PROCESSING") ordersToPack++;
    else if (o.status === "PACKED") packedOrders++;
    else if (o.status === "SHIPPED") shippedOrders++;
    else if (o.status === "DELIVERED") deliveredOrders++;
    else if (o.status === "CANCELLED") cancelledOrders++;

    if (o.paymentStatus === "UNPAID") unpaidOrders++;
  }

  // 3. Payments collected
  const allPayments = await (db as any)
    .select({ amount: payments.amount })
    .from(payments)
    .where(eq(payments.workspaceId, workspaceId));

  const totalCollected = allPayments.reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
  const outstandingBalance = Math.max(0, totalOrderValue - totalCollected);

  return {
    products: {
      total: allProducts.length,
      physicalStock,
      reservedStock,
      availableStock,
      lowStock: lowStockProducts,
      outOfStock: outOfStockProducts,
      valuation: Math.round(inventoryValuation * 100) / 100,
    },
    orders: {
      total: totalOrders,
      new: newOrders,
      toPack: ordersToPack,
      packed: packedOrders,
      shipped: shippedOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
      unpaid: unpaidOrders,
      totalValue: Math.round(totalOrderValue * 100) / 100,
    },
    financials: {
      totalRevenue: Math.round(totalOrderValue * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    },
  };
}

export function generateCsv(data: Array<Record<string, any>>): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : "";
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
