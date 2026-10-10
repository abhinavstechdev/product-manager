import { getDb } from "../db/client";
import {
  orders,
  orderItems,
  orderStatusHistory,
  customers,
  products,
  payments,
  shipments,
  returns,
  idempotencyRecords,
} from "../db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { reserveStockForOrder, releaseStockForOrder, StockActor } from "./inventory-service";
import { logAuditEvent } from "../audit/audit-service";
import { dispatchMcpEvent } from "../mcp/events";
import { getBaseUrl } from "../config/urls";

export interface CreateOrderParams {
  workspaceId: string;
  customerId?: string | null;
  newCustomer?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    shippingAddress: string;
    notes?: string | null;
  } | null;
  shippingAddress?: string;
  source: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice?: number;
    discount?: number;
  }>;
  orderDiscount?: number;
  shippingFee?: number;
  paymentMethod?: string;
  paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  initialPaymentAmount?: number;
  packingNotes?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  actor: StockActor;
  sourceType: "web" | "mcp";
}

export async function generateOrderNumber(workspaceId: string): Promise<string> {
  const db = await getDb();
  const currentYear = new Date().getFullYear();
  const prefix = `ORD-${currentYear}-`;

  const [latestOrder] = await (db as any)
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(and(eq(orders.workspaceId, workspaceId), sql`${orders.orderNumber} LIKE ${prefix + "%"}`))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  let nextSequence = 1;
  if (latestOrder && latestOrder.orderNumber) {
    const parts = latestOrder.orderNumber.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) {
      nextSequence = num + 1;
    }
  }

  const padded = String(nextSequence).padStart(6, "0");
  return `${prefix}${padded}`;
}

export async function createOrder(params: CreateOrderParams) {
  const db = await getDb();

  // 1. Idempotency Check
  if (params.idempotencyKey) {
    const [existingIdemp] = await (db as any)
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.workspaceId, params.workspaceId),
          eq(idempotencyRecords.idempotencyKey, params.idempotencyKey)
        )
      )
      .limit(1);

    if (existingIdemp) {
      return JSON.parse(existingIdemp.responseBody);
    }
  }

  // 2. Resolve Customer
  let resolvedCustomerId = params.customerId;
  let resolvedShippingAddress = params.shippingAddress || "";

  if (!resolvedCustomerId && params.newCustomer) {
    const newCustId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await (db as any).insert(customers).values({
      id: newCustId,
      workspaceId: params.workspaceId,
      name: params.newCustomer.name,
      phone: params.newCustomer.phone || null,
      email: params.newCustomer.email || null,
      shippingAddress: params.newCustomer.shippingAddress,
      notes: params.newCustomer.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    resolvedCustomerId = newCustId;
    if (!resolvedShippingAddress) {
      resolvedShippingAddress = params.newCustomer.shippingAddress;
    }
  } else if (resolvedCustomerId) {
    const [cust] = await (db as any)
      .select()
      .from(customers)
      .where(and(eq(customers.id, resolvedCustomerId), eq(customers.workspaceId, params.workspaceId)))
      .limit(1);

    if (!cust) {
      throw new Error(`Customer not found: ${resolvedCustomerId}`);
    }
    if (!resolvedShippingAddress) {
      resolvedShippingAddress = cust.shippingAddress;
    }
  } else {
    throw new Error("Either customerId or newCustomer details must be provided.");
  }

  // 3. Resolve Items and Calculate Totals
  const resolvedItems: Array<{
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    discount: string;
    totalPrice: string;
  }> = [];

  let subtotalNum = 0;

  for (const item of params.items) {
    const [prod] = await (db as any)
      .select()
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.workspaceId, params.workspaceId)))
      .limit(1);

    if (!prod) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const unitPriceNum = item.unitPrice !== undefined ? item.unitPrice : parseFloat(prod.sellingPrice);
    const itemDiscountNum = item.discount || 0;
    const itemTotalNum = Math.max(0, unitPriceNum * item.quantity - itemDiscountNum);

    subtotalNum += itemTotalNum;

    resolvedItems.push({
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      quantity: item.quantity,
      unitPrice: unitPriceNum.toFixed(2),
      discount: itemDiscountNum.toFixed(2),
      totalPrice: itemTotalNum.toFixed(2),
    });
  }

  const orderDiscountNum = params.orderDiscount || 0;
  const shippingFeeNum = params.shippingFee || 0;
  const totalAmountNum = Math.max(0, subtotalNum - orderDiscountNum + shippingFeeNum);

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const orderNumber = await generateOrderNumber(params.workspaceId);

  // 4. Reserve stock atomically
  await reserveStockForOrder({
    workspaceId: params.workspaceId,
    orderId,
    orderNumber,
    items: params.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
    actor: params.actor,
  });

  // 5. Insert Order
  const initialPaymentStatus = params.paymentStatus || "UNPAID";
  await (db as any).insert(orders).values({
    id: orderId,
    workspaceId: params.workspaceId,
    orderNumber,
    customerId: resolvedCustomerId,
    shippingAddress: resolvedShippingAddress,
    source: params.source || "WhatsApp",
    status: "CONFIRMED", // Order starts confirmed with inventory reserved
    subtotal: subtotalNum.toFixed(2),
    discount: orderDiscountNum.toFixed(2),
    shippingFee: shippingFeeNum.toFixed(2),
    totalAmount: totalAmountNum.toFixed(2),
    paymentStatus: initialPaymentStatus,
    paymentMethod: params.paymentMethod || "Cash on Delivery",
    packingNotes: params.packingNotes || null,
    notes: params.notes || null,
    idempotencyKey: params.idempotencyKey || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 6. Insert Order Items
  for (const it of resolvedItems) {
    const itemId = `oi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await (db as any).insert(orderItems).values({
      id: itemId,
      orderId,
      productId: it.productId,
      sku: it.sku,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      totalPrice: it.totalPrice,
    });
  }

  // 7. Status History
  await (db as any).insert(orderStatusHistory).values({
    id: `osh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderId,
    prevStatus: null,
    newStatus: "CONFIRMED",
    actorId: params.actor.id,
    actorName: params.actor.name,
    source: params.sourceType,
    note: "Order created and stock reserved",
    createdAt: new Date(),
  });

  // 8. If initial payment recorded
  if (params.initialPaymentAmount && params.initialPaymentAmount > 0) {
    await (db as any).insert(payments).values({
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: params.workspaceId,
      orderId,
      amount: params.initialPaymentAmount.toFixed(2),
      paymentMethod: params.paymentMethod || "Cash",
      reference: "Initial Payment",
      notes: "Recorded at order creation",
      createdAt: new Date(),
    });
  }

  // 9. Audit event
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "create_order" : null,
    operation: "CREATE_ORDER",
    targetRecord: orderNumber,
    afterState: {
      orderId,
      orderNumber,
      totalAmount: totalAmountNum,
      itemCount: resolvedItems.length,
    },
    outcome: "SUCCESS",
    idempotencyKey: params.idempotencyKey || null,
  });

  const responseResult = {
    orderId,
    orderNumber,
    customerId: resolvedCustomerId,
    shippingAddress: resolvedShippingAddress,
    status: "CONFIRMED",
    subtotal: subtotalNum.toFixed(2),
    discount: orderDiscountNum.toFixed(2),
    shippingFee: shippingFeeNum.toFixed(2),
    totalAmount: totalAmountNum.toFixed(2),
    paymentStatus: initialPaymentStatus,
    items: resolvedItems,
  };

  // 10. Record Idempotency Key
  if (params.idempotencyKey) {
    await (db as any).insert(idempotencyRecords).values({
      id: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: params.workspaceId,
      idempotencyKey: params.idempotencyKey,
      operation: "CREATE_ORDER",
      responseStatus: 201,
      responseBody: JSON.stringify(responseResult),
      createdAt: new Date(),
    });
  }

  // 11. Dispatch MCP Event: order.created
  dispatchMcpEvent(params.workspaceId, "order.created", {
    order_id: orderId,
    order_number: orderNumber,
    customer_id: resolvedCustomerId,
    customer_name: params.newCustomer?.name || "Customer",
    total_amount: totalAmountNum,
    status: "CONFIRMED",
    payment_status: initialPaymentStatus,
    items_count: resolvedItems.length,
    url: `${getBaseUrl()}/orders#${orderId}`,
  });

  return responseResult;
}

export async function updateOrderStatus(params: {
  workspaceId: string;
  orderId: string;
  newStatus: "NEW" | "CONFIRMED" | "PROCESSING" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
  note?: string | null;
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

  const prevStatus = order.status;

  if (prevStatus === params.newStatus) {
    return { success: true, orderId: order.id, status: prevStatus, message: "Status already set" };
  }

  // Validate state transitions
  const validTransitions: Record<string, string[]> = {
    NEW: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "PACKED", "CANCELLED"],
    PROCESSING: ["PACKED", "CANCELLED"],
    PACKED: ["SHIPPED", "CONFIRMED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "RETURNED"],
    DELIVERED: ["RETURNED"],
    CANCELLED: [],
    RETURNED: [],
  };

  if (validTransitions[prevStatus] && !validTransitions[prevStatus].includes(params.newStatus)) {
    throw new Error(`Invalid order status transition from ${prevStatus} to ${params.newStatus}`);
  }

  // If cancelling an order that held reservations: release reserved stock!
  if (params.newStatus === "CANCELLED" && ["NEW", "CONFIRMED", "PROCESSING", "PACKED"].includes(prevStatus)) {
    const items = await (db as any)
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    await releaseStockForOrder({
      workspaceId: params.workspaceId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: items.map((it: any) => ({ productId: it.productId, quantity: it.quantity })),
      actor: params.actor,
      reason: `Order ${order.orderNumber} cancelled by ${params.actor.name}`,
    });
  }

  // Update order status
  await (db as any)
    .update(orders)
    .set({
      status: params.newStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // Insert status history
  await (db as any).insert(orderStatusHistory).values({
    id: `osh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderId: order.id,
    prevStatus,
    newStatus: params.newStatus,
    actorId: params.actor.id,
    actorName: params.actor.name,
    source: params.sourceType,
    note: params.note || `Status transition: ${prevStatus} -> ${params.newStatus}`,
    createdAt: new Date(),
  });

  // Audit event
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "update_order_status" : null,
    operation: "UPDATE_ORDER_STATUS",
    targetRecord: order.orderNumber,
    beforeState: { status: prevStatus },
    afterState: { status: params.newStatus },
    outcome: "SUCCESS",
  });

  // Dispatch MCP Event: order.status_changed
  dispatchMcpEvent(params.workspaceId, "order.status_changed", {
    order_id: order.id,
    order_number: order.orderNumber,
    previous_status: prevStatus,
    current_status: params.newStatus,
    url: `${getBaseUrl()}/orders#${order.id}`,
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    previousStatus: prevStatus,
    currentStatus: params.newStatus,
  };
}

export async function getOrderDetails(workspaceId: string, orderIdOrNumber: string) {
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

  if (!order) return null;

  const items = await (db as any)
    .select({
      item: orderItems,
      product: {
        id: products.id,
        imageUrl: products.imageUrl,
        barcode: products.barcode,
      },
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.order.id));

  const history = await (db as any)
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.order.id))
    .orderBy(desc(orderStatusHistory.createdAt));

  const orderPayments = await (db as any)
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.order.id))
    .orderBy(desc(payments.createdAt));

  return {
    ...order.order,
    customer: order.customer,
    items: items.map((i: any) => ({ ...i.item, product: i.product })),
    history,
    payments: orderPayments,
  };
}

export async function listOrders(workspaceId: string, options?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  let query = (db as any)
    .select({
      order: orders,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.workspaceId, workspaceId))
    .orderBy(desc(orders.createdAt));

  const results = await query.limit(options?.limit || 50).offset(options?.offset || 0);

  let filtered = results.map((r: any) => ({
    ...r.order,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
  }));

  if (options?.status) {
    filtered = filtered.filter((o: any) => o.status === options.status);
  }
  if (options?.paymentStatus) {
    filtered = filtered.filter((o: any) => o.paymentStatus === options.paymentStatus);
  }
  if (options?.search) {
    const s = options.search.toLowerCase();
    filtered = filtered.filter(
      (o: any) =>
        o.orderNumber.toLowerCase().includes(s) ||
        (o.customerName && o.customerName.toLowerCase().includes(s))
    );
  }

  return filtered;
}

export async function deleteOrder(params: {
  workspaceId: string;
  orderIdOrNumber: string;
  actor: StockActor;
  force?: boolean;
}) {
  const db = await getDb();
  const [order] = await (db as any)
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.workspaceId, params.workspaceId),
        or(
          eq(orders.id, params.orderIdOrNumber),
          eq(orders.orderNumber, params.orderIdOrNumber.toUpperCase())
        )
      )
    )
    .limit(1);

  if (!order) {
    throw new Error(`Order not found: "${params.orderIdOrNumber}"`);
  }

  // Get items
  const items = await (db as any)
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  // If order is in active reserved state (NEW, CONFIRMED, PROCESSING, PACKED), release reserved inventory!
  if (["NEW", "CONFIRMED", "PROCESSING", "PACKED"].includes(order.status)) {
    await releaseStockForOrder({
      workspaceId: params.workspaceId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      actor: params.actor,
      reason: `Order ${order.orderNumber} deleted`,
    });
  } else if (["SHIPPED", "DELIVERED"].includes(order.status) && !params.force) {
    throw new Error(
      `Order ${order.orderNumber} is already '${order.status}'. To delete anyway, set force: true.`
    );
  }

  // Delete cascaded records and order
  await (db as any).delete(orderItems).where(eq(orderItems.orderId, order.id));
  await (db as any).delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id));
  await (db as any).delete(shipments).where(eq(shipments.orderId, order.id));
  await (db as any).delete(payments).where(eq(payments.orderId, order.id));
  await (db as any).delete(returns).where(eq(returns.orderId, order.id));
  await (db as any).delete(orders).where(eq(orders.id, order.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "delete_order" : null,
    operation: "DELETE_ORDER",
    targetRecord: order.orderNumber,
    beforeState: order,
    afterState: null,
    outcome: "SUCCESS",
  });

  return {
    success: true,
    deletedId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    releasedItemsCount: items.length,
  };
}
