import { getDb } from "../db/client";
import { products, inventoryTransactions } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "../audit/audit-service";
import { dispatchMcpEvent } from "../mcp/events";
import { getBaseUrl } from "../config/urls";

export interface StockActor {
  id: string;
  name: string;
  type: "USER" | "AI_AGENT";
}

export async function adjustInventory(params: {
  workspaceId: string;
  productId: string;
  quantityChange: number;
  reason: string;
  type?: "MANUAL_ADJUSTMENT" | "STOCK_RECEIVED" | "DAMAGED_GOODS" | "STOCK_CORRECTION";
  actor: StockActor;
}) {
  const db = await getDb();

  // Find product and verify workspace
  const [product] = await (db as any)
    .select()
    .from(products)
    .where(and(eq(products.id, params.productId), eq(products.workspaceId, params.workspaceId)))
    .limit(1);

  if (!product) {
    throw new Error(`Product not found: ${params.productId}`);
  }

  const prevQty = product.physicalStock;
  const newQty = prevQty + params.quantityChange;

  if (newQty < 0) {
    throw new Error(`Cannot reduce physical stock below 0. Current physical stock: ${prevQty}, Requested change: ${params.quantityChange}`);
  }

  const newAvailable = newQty - product.reservedStock;
  if (newAvailable < 0) {
    throw new Error(`Adjustment would breach reserved stock! Current reserved: ${product.reservedStock}, resulting physical: ${newQty}`);
  }

  const txType = params.type || (params.quantityChange > 0 ? "STOCK_RECEIVED" : "MANUAL_ADJUSTMENT");

  // Update physical stock
  await (db as any)
    .update(products)
    .set({
      physicalStock: newQty,
      updatedAt: new Date(),
    })
    .where(eq(products.id, product.id));

  // Insert ledger transaction
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await (db as any).insert(inventoryTransactions).values({
    id: txId,
    workspaceId: params.workspaceId,
    productId: product.id,
    changeQty: params.quantityChange,
    prevQty,
    newQty,
    transactionType: txType,
    reason: params.reason,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type,
    createdAt: new Date(),
  });

  // Audit log
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    operation: "ADJUST_INVENTORY",
    targetRecord: product.sku,
    beforeState: { physicalStock: prevQty, reservedStock: product.reservedStock },
    afterState: { physicalStock: newQty, reservedStock: product.reservedStock },
    outcome: "SUCCESS",
  });

  // Dispatch MCP Events
  dispatchMcpEvent(params.workspaceId, "inventory.adjusted", {
    transaction_id: txId,
    sku: product.sku,
    product_name: product.name,
    type: txType,
    quantity_change: params.quantityChange,
    new_physical_stock: newQty,
    notes: params.reason,
  });

  if (newAvailable <= 10) {
    dispatchMcpEvent(params.workspaceId, "inventory.low_stock", {
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      physical_stock: newQty,
      reserved_stock: product.reservedStock,
      available_stock: newAvailable,
      threshold: 10,
      url: `${getBaseUrl()}/products#${product.id}`,
    });
  }

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    previousStock: prevQty,
    newStock: newQty,
    reservedStock: product.reservedStock,
    availableStock: newQty - product.reservedStock,
    transactionId: txId,
  };
}

export async function reserveStockForOrder(params: {
  workspaceId: string;
  orderId: string;
  orderNumber: string;
  items: Array<{ productId: string; quantity: number }>;
  actor: StockActor;
  tx?: any;
}) {
  const client = params.tx || (await getDb());

  // Validate all items have sufficient available stock first
  for (const item of params.items) {
    const [p] = await (client as any)
      .select()
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.workspaceId, params.workspaceId)))
      .limit(1);

    if (!p) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const available = p.physicalStock - p.reservedStock;
    if (available < item.quantity) {
      throw new Error(`Insufficient available stock for SKU ${p.sku} (${p.name}). Requested: ${item.quantity}, Available: ${available} (Physical: ${p.physicalStock}, Reserved: ${p.reservedStock})`);
    }
  }

  // Atomically increment reservedStock with concurrency check and log ledger
  for (const item of params.items) {
    const [p] = await (client as any)
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    const prevReserved = p.reservedStock;
    const newReserved = prevReserved + item.quantity;

    const updateRes = await (client as any)
      .update(products)
      .set({
        reservedStock: sql`${products.reservedStock} + ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, p.id),
          sql`(${products.physicalStock} - ${products.reservedStock}) >= ${item.quantity}`
        )
      )
      .returning();

    if (!updateRes || updateRes.length === 0) {
      throw new Error(`Insufficient available stock for SKU ${p.sku} (${p.name}). Concurrent reservation occurred.`);
    }

    const txId = `tx_res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await (client as any).insert(inventoryTransactions).values({
      id: txId,
      workspaceId: params.workspaceId,
      productId: p.id,
      changeQty: item.quantity,
      prevQty: prevReserved,
      newQty: newReserved,
      transactionType: "STOCK_RESERVED",
      reason: `Reserved for order ${params.orderNumber || params.orderId}`,
      orderId: params.orderId,
      actorId: params.actor?.id || "system",
      actorName: params.actor?.name || "System Automated",
      actorType: params.actor?.type || "SYSTEM",
      createdAt: new Date(),
    });
  }
}

export async function releaseStockForOrder(params: {
  workspaceId: string;
  orderId: string;
  orderNumber: string;
  items: Array<{ productId: string; quantity: number }>;
  actor: StockActor;
  reason?: string;
}) {
  const db = await getDb();

  for (const item of params.items) {
    const [p] = await (db as any)
      .select()
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.workspaceId, params.workspaceId)))
      .limit(1);

    if (!p) continue;

    const prevReserved = p.reservedStock;
    const newReserved = Math.max(0, prevReserved - item.quantity);

    await (db as any)
      .update(products)
      .set({
        reservedStock: newReserved,
        updatedAt: new Date(),
      })
      .where(eq(products.id, p.id));

    const txId = `tx_rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await (db as any).insert(inventoryTransactions).values({
      id: txId,
      workspaceId: params.workspaceId,
      productId: p.id,
      changeQty: -item.quantity,
      prevQty: prevReserved,
      newQty: newReserved,
      transactionType: "RESERVATION_RELEASED",
      reason: params.reason || `Reservation released for order ${params.orderNumber}`,
      orderId: params.orderId,
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorType: params.actor.type,
      createdAt: new Date(),
    });
  }
}

export async function dispatchStockForOrder(params: {
  workspaceId: string;
  orderId: string;
  orderNumber: string;
  items: Array<{ productId: string; quantity: number }>;
  actor: StockActor;
}) {
  const db = await getDb();

  for (const item of params.items) {
    const [p] = await (db as any)
      .select()
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.workspaceId, params.workspaceId)))
      .limit(1);

    if (!p) continue;

    const prevPhysical = p.physicalStock;
    const newPhysical = Math.max(0, prevPhysical - item.quantity);
    const prevReserved = p.reservedStock;
    const newReserved = Math.max(0, prevReserved - item.quantity);

    await (db as any)
      .update(products)
      .set({
        physicalStock: newPhysical,
        reservedStock: newReserved,
        updatedAt: new Date(),
      })
      .where(eq(products.id, p.id));

    const txId = `tx_disp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await (db as any).insert(inventoryTransactions).values({
      id: txId,
      workspaceId: params.workspaceId,
      productId: p.id,
      changeQty: -item.quantity,
      prevQty: prevPhysical,
      newQty: newPhysical,
      transactionType: "ORDER_DISPATCHED",
      reason: `Dispatched in shipment for order ${params.orderNumber}`,
      orderId: params.orderId,
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorType: params.actor.type,
      createdAt: new Date(),
    });
  }
}

export async function getInventorySummary(workspaceId: string) {
  const db = await getDb();
  const prods = await (db as any)
    .select()
    .from(products)
    .where(eq(products.workspaceId, workspaceId));

  let totalPhysicalStock = 0;
  let totalReservedStock = 0;
  let totalAvailableStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalValuation = 0;

  for (const p of prods) {
    totalPhysicalStock += p.physicalStock;
    totalReservedStock += p.reservedStock;
    const available = p.physicalStock - p.reservedStock;
    totalAvailableStock += available;

    if (available <= 0) {
      outOfStockCount++;
    } else if (available <= p.reorderThreshold) {
      lowStockCount++;
    }

    const cost = parseFloat(p.purchaseCost || "0");
    totalValuation += cost * p.physicalStock;
  }

  return {
    totalProductCount: prods.length,
    totalPhysicalStock,
    totalReservedStock,
    totalAvailableStock,
    lowStockCount,
    outOfStockCount,
    totalValuation: Math.round(totalValuation * 100) / 100,
  };
}

export async function listInventoryTransactions(workspaceId: string, limit: number = 50) {
  const db = await getDb();
  return await (db as any)
    .select({
      transaction: inventoryTransactions,
      product: {
        id: products.id,
        name: products.name,
        sku: products.sku,
      },
    })
    .from(inventoryTransactions)
    .leftJoin(products, eq(inventoryTransactions.productId, products.id))
    .where(eq(inventoryTransactions.workspaceId, workspaceId))
    .orderBy(sql`${inventoryTransactions.createdAt} DESC`)
    .limit(limit);
}
