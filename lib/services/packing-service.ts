import { getDb } from "../db/client";
import { orders, customers, orderItems, products } from "../db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { updateOrderStatus } from "./order-service";
import { StockActor } from "./inventory-service";

export async function listOrdersToPack(workspaceId: string) {
  const db = await getDb();

  const results = await (db as any)
    .select({
      order: orders,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orders.workspaceId, workspaceId),
        inArray(orders.status, ["CONFIRMED", "PROCESSING"])
      )
    )
    .orderBy(desc(orders.createdAt));

  return results.map((r: any) => ({
    ...r.order,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
  }));
}

export async function getPackingSlip(workspaceId: string, orderIdOrNumber: string) {
  const db = await getDb();

  const [order] = await (db as any)
    .select({
      order: orders,
      customer: customers,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orders.workspaceId, workspaceId),
        sql`(${orders.id} = ${orderIdOrNumber} OR ${orders.orderNumber} = ${orderIdOrNumber})`
      )
    )
    .limit(1);

  if (!order) {
    throw new Error(`Order not found: ${orderIdOrNumber}`);
  }

  const items = await (db as any)
    .select({
      item: orderItems,
      barcode: products.barcode,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.order.id));

  const totalQuantity = items.reduce((sum: number, i: any) => sum + i.item.quantity, 0);

  return {
    orderNumber: order.order.orderNumber,
    orderDate: order.order.createdAt,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    shippingAddress: order.order.shippingAddress,
    packingNotes: order.order.packingNotes,
    specialInstructions: order.order.notes,
    totalQuantity,
    items: items.map((i: any) => ({
      sku: i.item.sku,
      productName: i.item.productName,
      quantity: i.item.quantity,
      barcode: i.barcode,
    })),
  };
}

export async function markOrderPacked(params: {
  workspaceId: string;
  orderId: string;
  packingNotes?: string | null;
  actor: StockActor;
  sourceType: "web" | "mcp";
}) {
  const db = await getDb();

  if (params.packingNotes) {
    await (db as any)
      .update(orders)
      .set({
        packingNotes: params.packingNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, params.orderId), eq(orders.workspaceId, params.workspaceId)));
  }

  return await updateOrderStatus({
    workspaceId: params.workspaceId,
    orderId: params.orderId,
    newStatus: "PACKED",
    note: params.packingNotes ? `Packed: ${params.packingNotes}` : "Order packed and ready for dispatch",
    actor: params.actor,
    sourceType: params.sourceType,
  });
}
