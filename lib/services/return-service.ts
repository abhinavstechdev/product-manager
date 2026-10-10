import { getDb } from "../db/client";
import { returns, returnItems, orders, products, inventoryTransactions } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { StockActor } from "./inventory-service";
import { updateOrderStatus } from "./order-service";
import { logAuditEvent } from "../audit/audit-service";

export async function registerReturn(params: {
  workspaceId: string;
  orderId: string;
  reason: string;
  items: Array<{
    productId: string;
    quantity: number;
    condition: "sellable" | "damaged";
  }>;
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

  const returnId = `ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();

  await (db as any).insert(returns).values({
    id: returnId,
    workspaceId: params.workspaceId,
    orderId: order.id,
    status: "REGISTERED",
    reason: params.reason,
    refundAmount: "0.00",
    notes: params.notes || null,
    createdAt: now,
  });

  for (const item of params.items) {
    const rItemId = `ri_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await (db as any).insert(returnItems).values({
      id: rItemId,
      returnId,
      productId: item.productId,
      quantity: item.quantity,
      condition: item.condition,
      actionTaken: "PENDING_INSPECTION",
    });
  }

  // Audit log
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "register_return" : null,
    operation: "REGISTER_RETURN",
    targetRecord: order.orderNumber,
    afterState: { returnId, reason: params.reason, itemCount: params.items.length },
    outcome: "SUCCESS",
  });

  return {
    returnId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: "REGISTERED",
    items: params.items,
  };
}

export async function approveReturn(params: {
  workspaceId: string;
  returnId: string;
  refundAmount?: number;
  restockSellable?: boolean;
  notes?: string | null;
  actor: StockActor;
  sourceType: "web" | "mcp";
}) {
  const db = await getDb();

  const [ret] = await (db as any)
    .select()
    .from(returns)
    .where(and(eq(returns.id, params.returnId), eq(returns.workspaceId, params.workspaceId)))
    .limit(1);

  if (!ret) {
    throw new Error(`Return record not found: ${params.returnId}`);
  }

  if (ret.status !== "REGISTERED") {
    throw new Error(`Return is already ${ret.status}.`);
  }

  const items = await (db as any)
    .select()
    .from(returnItems)
    .where(eq(returnItems.returnId, ret.id));

  const [order] = await (db as any)
    .select()
    .from(orders)
    .where(eq(orders.id, ret.orderId))
    .limit(1);

  const now = new Date();
  const restock = params.restockSellable !== false;

  // Process inventory restoration for inspected sellable items
  for (const item of items) {
    const [p] = await (db as any)
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (!p) continue;

    if (item.condition === "sellable" && restock) {
      const prevQty = p.physicalStock;
      const newQty = prevQty + item.quantity;

      await (db as any)
        .update(products)
        .set({ physicalStock: newQty, updatedAt: now })
        .where(eq(products.id, p.id));

      await (db as any).insert(inventoryTransactions).values({
        id: `tx_ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: params.workspaceId,
        productId: p.id,
        changeQty: item.quantity,
        prevQty,
        newQty,
        transactionType: "RETURN_APPROVED_RESALE",
        reason: `Restocked approved return for order ${order?.orderNumber || ret.orderId}`,
        orderId: ret.orderId,
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorType: params.actor.type,
        createdAt: now,
      });

      await (db as any)
        .update(returnItems)
        .set({ actionTaken: "RESTOCKED" })
        .where(eq(returnItems.id, item.id));
    } else {
      await (db as any).insert(inventoryTransactions).values({
        id: `tx_dam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: params.workspaceId,
        productId: p.id,
        changeQty: 0,
        prevQty: p.physicalStock,
        newQty: p.physicalStock,
        transactionType: "DAMAGED_GOODS",
        reason: `Damaged item quarantined in return for order ${order?.orderNumber || ret.orderId}`,
        orderId: ret.orderId,
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorType: params.actor.type,
        createdAt: now,
      });

      await (db as any)
        .update(returnItems)
        .set({ actionTaken: "WRITTEN_OFF" })
        .where(eq(returnItems.id, item.id));
    }
  }

  // Update return status
  const refundAmountStr = (params.refundAmount || 0).toFixed(2);
  await (db as any)
    .update(returns)
    .set({
      status: "APPROVED",
      refundAmount: refundAmountStr,
      notes: params.notes || ret.notes,
      approvedAt: now,
    })
    .where(eq(returns.id, ret.id));

  // Update order status to RETURNED
  if (order) {
    await updateOrderStatus({
      workspaceId: params.workspaceId,
      orderId: order.id,
      newStatus: "RETURNED",
      note: `Return approved with refund ₹${refundAmountStr}`,
      actor: params.actor,
      sourceType: params.sourceType,
    });
  }

  // Audit log
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "approve_return" : null,
    operation: "APPROVE_RETURN",
    targetRecord: order?.orderNumber || ret.id,
    afterState: { returnId: ret.id, refundAmount: refundAmountStr, status: "APPROVED" },
    outcome: "SUCCESS",
  });

  return {
    returnId: ret.id,
    orderId: ret.orderId,
    status: "APPROVED",
    refundAmount: refundAmountStr,
  };
}

export async function rejectReturn(params: {
  workspaceId: string;
  returnId: string;
  reason?: string;
  actor: StockActor;
  sourceType: "web" | "mcp";
}) {
  const db = await getDb();

  const [ret] = await (db as any)
    .select()
    .from(returns)
    .where(and(eq(returns.id, params.returnId), eq(returns.workspaceId, params.workspaceId)))
    .limit(1);

  if (!ret) {
    throw new Error(`Return record not found: ${params.returnId}`);
  }

  const now = new Date();
  await (db as any)
    .update(returns)
    .set({
      status: "REJECTED",
      notes: params.reason ? `Rejected: ${params.reason}` : ret.notes,
    })
    .where(eq(returns.id, ret.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "reject_return" : null,
    operation: "REJECT_RETURN",
    targetRecord: ret.id,
    afterState: { returnId: ret.id, status: "REJECTED" },
    outcome: "SUCCESS",
  });

  return {
    returnId: ret.id,
    status: "REJECTED",
  };
}

export async function listReturns(workspaceId: string) {
  const db = await getDb();
  return await (db as any)
    .select({
      returnRecord: returns,
      orderNumber: orders.orderNumber,
      orderTotal: orders.totalAmount,
    })
    .from(returns)
    .leftJoin(orders, eq(returns.orderId, orders.id))
    .where(eq(returns.workspaceId, workspaceId))
    .orderBy(desc(returns.createdAt));
}

export async function deleteReturn(params: {
  workspaceId: string;
  returnId: string;
  actor: StockActor;
}) {
  const db = await getDb();
  const [ret] = await (db as any)
    .select()
    .from(returns)
    .where(and(eq(returns.id, params.returnId), eq(returns.workspaceId, params.workspaceId)))
    .limit(1);

  if (!ret) {
    throw new Error(`Return record not found: "${params.returnId}"`);
  }

  // Delete return items and return
  await (db as any).delete(returnItems).where(eq(returnItems.returnId, ret.id));
  await (db as any).delete(returns).where(eq(returns.id, ret.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "delete_return" : null,
    operation: "DELETE_RETURN",
    targetRecord: ret.id,
    beforeState: ret,
    afterState: null,
    outcome: "SUCCESS",
  });

  return { success: true, deletedId: ret.id, orderId: ret.orderId };
}
