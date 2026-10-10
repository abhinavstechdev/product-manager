import { getDb } from "../db/client";
import { orders, shipments, orderItems, customers, orderStatusHistory } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { dispatchStockForOrder, StockActor } from "./inventory-service";
import { logAuditEvent } from "../audit/audit-service";
import { dispatchMcpEvent } from "../mcp/events";
import { getBaseUrl } from "../config/urls";

export async function listOrdersToShip(workspaceId: string) {
  const db = await getDb();

  const results = await (db as any)
    .select({
      order: orders,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.workspaceId, workspaceId), eq(orders.status, "PACKED")))
    .orderBy(desc(orders.createdAt));

  return results.map((r: any) => ({
    ...r.order,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
  }));
}

export async function markOrderShipped(params: {
  workspaceId: string;
  orderId: string;
  courier: string;
  trackingNumber: string;
  expectedDeliveryDays?: number;
  notes?: string | null;
  actor: StockActor;
  sourceType: "web" | "mcp";
}) {
  const db = await getDb();

  // 1. Fetch order
  const [order] = await (db as any)
    .select()
    .from(orders)
    .where(and(eq(orders.id, params.orderId), eq(orders.workspaceId, params.workspaceId)))
    .limit(1);

  if (!order) {
    throw new Error(`Order not found: ${params.orderId}`);
  }

  if (order.status !== "PACKED") {
    throw new Error(`Order ${order.orderNumber} cannot be shipped. Current status is ${order.status}, must be PACKED.`);
  }

  // 2. Fetch order items
  const items = await (db as any)
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  // 3. Dispatch stock: deduct physical stock and release reserved stock atomically
  await dispatchStockForOrder({
    workspaceId: params.workspaceId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    items: items.map((it: any) => ({ productId: it.productId, quantity: it.quantity })),
    actor: params.actor,
  });

  // 4. Create Shipment record
  const shipmentId = `shp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const deliveryDays = params.expectedDeliveryDays || 3;
  const expectedDate = new Date(now.getTime() + deliveryDays * 24 * 60 * 60 * 1000);

  await (db as any).insert(shipments).values({
    id: shipmentId,
    workspaceId: params.workspaceId,
    orderId: order.id,
    courier: params.courier,
    trackingNumber: params.trackingNumber,
    shippedAt: now,
    expectedDeliveryAt: expectedDate,
    notes: params.notes || null,
    createdAt: now,
  });

  // 5. Update order status
  await (db as any)
    .update(orders)
    .set({
      status: "SHIPPED",
      updatedAt: now,
    })
    .where(eq(orders.id, order.id));

  // 6. Status history
  await (db as any).insert(orderStatusHistory).values({
    id: `osh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderId: order.id,
    prevStatus: "PACKED",
    newStatus: "SHIPPED",
    actorId: params.actor.id,
    actorName: params.actor.name,
    source: params.sourceType,
    note: `Shipped via ${params.courier} (Tracking: ${params.trackingNumber})`,
    createdAt: now,
  });

  // 7. Audit event
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "mark_order_shipped" : null,
    operation: "MARK_ORDER_SHIPPED",
    targetRecord: order.orderNumber,
    beforeState: { status: "PACKED" },
    afterState: {
      status: "SHIPPED",
      courier: params.courier,
      trackingNumber: params.trackingNumber,
    },
    outcome: "SUCCESS",
  });

  dispatchMcpEvent(params.workspaceId, "order.status_changed", {
    order_id: order.id,
    order_number: order.orderNumber,
    previous_status: "PACKED",
    current_status: "SHIPPED",
    tracking_number: params.trackingNumber,
    courier: params.courier,
    url: `${getBaseUrl()}/orders#${order.id}`,
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    shipmentId,
    courier: params.courier,
    trackingNumber: params.trackingNumber,
    expectedDeliveryAt: expectedDate,
    status: "SHIPPED",
  };
}

export async function markOrderDelivered(params: {
  workspaceId: string;
  orderId: string;
  notes?: string | null;
  actor: StockActor;
  sourceType: "web" | "mcp";
}) {
  const db = await getDb();

  const [order] = await (db as any)
    .select()
    .from(orders)
    .where(and(eq(orders.id, params.orderId), eq(orders.workspaceId, params.workspaceId)))
    .limit(1);

  if (!order) {
    throw new Error(`Order not found: ${params.orderId}`);
  }

  if (order.status !== "SHIPPED") {
    throw new Error(`Order ${order.orderNumber} must be SHIPPED before marking DELIVERED. Current status: ${order.status}`);
  }

  const now = new Date();

  await (db as any)
    .update(orders)
    .set({
      status: "DELIVERED",
      updatedAt: now,
    })
    .where(eq(orders.id, order.id));

  await (db as any).insert(orderStatusHistory).values({
    id: `osh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderId: order.id,
    prevStatus: "SHIPPED",
    newStatus: "DELIVERED",
    actorId: params.actor.id,
    actorName: params.actor.name,
    source: params.sourceType,
    note: params.notes || "Order delivered successfully to recipient",
    createdAt: now,
  });

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "mark_order_delivered" : null,
    operation: "MARK_ORDER_DELIVERED",
    targetRecord: order.orderNumber,
    beforeState: { status: "SHIPPED" },
    afterState: { status: "DELIVERED" },
    outcome: "SUCCESS",
  });

  dispatchMcpEvent(params.workspaceId, "order.status_changed", {
    order_id: order.id,
    order_number: order.orderNumber,
    previous_status: "SHIPPED",
    current_status: "DELIVERED",
    url: `${getBaseUrl()}/orders#${order.id}`,
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: "DELIVERED",
    paymentStatus: order.paymentStatus, // Note: Delivered does NOT automatically mark PAID!
  };
}

export async function listShipments(workspaceId: string) {
  const db = await getDb();
  return await (db as any)
    .select({
      shipment: shipments,
      orderNumber: orders.orderNumber,
      customerAddress: orders.shippingAddress,
    })
    .from(shipments)
    .leftJoin(orders, eq(shipments.orderId, orders.id))
    .where(eq(shipments.workspaceId, workspaceId))
    .orderBy(desc(shipments.createdAt));
}
