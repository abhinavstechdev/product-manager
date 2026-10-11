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
  workspaces,
} from "../db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { reserveStockForOrder, releaseStockForOrder, StockActor } from "./inventory-service";
import { logAuditEvent } from "../audit/audit-service";
import { dispatchMcpEvent } from "../mcp/events";
import { getBaseUrl } from "../config/urls";

export type OrderErrorCode =
  | "INVALID_ARGUMENT"
  | "CUSTOMER_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED"
  | "PAYMENT_VERIFICATION_REQUIRED"
  | "CONFIRMATION_REQUIRED"
  | "DUPLICATE_REQUEST"
  | "PERMISSION_DENIED"
  | "INTERNAL_ERROR";

export class OrderServiceError extends Error {
  constructor(
    public readonly code: OrderErrorCode,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

export interface CreateOrderParams {
  workspaceId: string;
  customerId?: string | null;
  newCustomer?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    shippingAddress?: string | null;
    notes?: string | null;
  } | null;
  shippingAddress?: string | null;
  source?: string;
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
  paymentReference?: string | null;
  paymentReportedByCustomer?: boolean;
  initialPaymentAmount?: number;
  packingNotes?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  confirmed?: boolean;
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

  // 1. Validate Items Argument
  if (!params.items || !Array.isArray(params.items) || params.items.length === 0) {
    throw new OrderServiceError("INVALID_ARGUMENT", "Order must contain at least one item.");
  }

  for (const it of params.items) {
    if (!it.productId || typeof it.productId !== "string" || it.productId.trim().length === 0) {
      throw new OrderServiceError("INVALID_ARGUMENT", "Each item must specify a valid productId.");
    }
    if (!it.quantity || typeof it.quantity !== "number" || it.quantity <= 0 || !Number.isInteger(it.quantity)) {
      throw new OrderServiceError("INVALID_ARGUMENT", `Invalid quantity '${it.quantity}' for product '${it.productId}'. Must be a positive integer.`);
    }
    if (it.unitPrice !== undefined && (typeof it.unitPrice !== "number" || it.unitPrice < 0)) {
      throw new OrderServiceError("INVALID_ARGUMENT", `Invalid unitPrice '${it.unitPrice}' for product '${it.productId}'. Cannot be negative.`);
    }
    if (it.discount !== undefined && (typeof it.discount !== "number" || it.discount < 0)) {
      throw new OrderServiceError("INVALID_ARGUMENT", `Invalid discount '${it.discount}' for product '${it.productId}'. Cannot be negative.`);
    }
  }

  if (params.orderDiscount !== undefined && (typeof params.orderDiscount !== "number" || params.orderDiscount < 0)) {
    throw new OrderServiceError("INVALID_ARGUMENT", "Order discount cannot be negative.");
  }
  if (params.shippingFee !== undefined && (typeof params.shippingFee !== "number" || params.shippingFee < 0)) {
    throw new OrderServiceError("INVALID_ARGUMENT", "Shipping fee cannot be negative.");
  }

  // 2. Idempotency Check
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
      try {
        const cachedOrder = JSON.parse(existingIdemp.responseBody);
        // Verify that the cached order corresponds to matching customer & items
        const sameCustomer = params.customerId ? cachedOrder.customerId === params.customerId : true;
        const cachedItems = cachedOrder.items || [];
        const sameItemCount = cachedItems.length === params.items.length;
        const sameItems = sameItemCount && params.items.every((it) => {
          const match = cachedItems.find((ci: any) => ci.productId === it.productId);
          return match && match.quantity === it.quantity;
        });

        if (sameCustomer && sameItems) {
          return cachedOrder;
        } else {
          throw new OrderServiceError(
            "DUPLICATE_REQUEST",
            `Idempotency key '${params.idempotencyKey}' was already used for a different order. Reusing keys with modified parameters is rejected.`,
            { idempotencyKey: params.idempotencyKey }
          );
        }
      } catch (e) {
        if (e instanceof OrderServiceError) throw e;
        return JSON.parse(existingIdemp.responseBody);
      }
    }
  }

  // 3. Resolve & Validate Customer
  let resolvedCustomerId = params.customerId || null;
  let resolvedShippingAddress = params.shippingAddress ? params.shippingAddress.trim() : "";

  if (resolvedCustomerId) {
    const [cust] = await (db as any)
      .select()
      .from(customers)
      .where(and(eq(customers.id, resolvedCustomerId), eq(customers.workspaceId, params.workspaceId)))
      .limit(1);

    if (!cust) {
      throw new OrderServiceError(
        "CUSTOMER_NOT_FOUND",
        `Customer with ID '${resolvedCustomerId}' does not exist in workspace.`,
        { customerId: resolvedCustomerId }
      );
    }
    if (!resolvedShippingAddress) {
      resolvedShippingAddress = cust.shippingAddress || "";
    }
    if (!resolvedShippingAddress || resolvedShippingAddress.length < 5) {
      throw new OrderServiceError(
        "INVALID_ARGUMENT",
        `Customer '${cust.name}' has no valid shipping address on file. Please supply shippingAddress with at least 5 characters.`
      );
    }
  } else if (params.newCustomer) {
    if (!params.newCustomer.name || params.newCustomer.name.trim().length === 0) {
      throw new OrderServiceError("INVALID_ARGUMENT", "New customer name is required.");
    }
    if (!resolvedShippingAddress && params.newCustomer.shippingAddress) {
      resolvedShippingAddress = params.newCustomer.shippingAddress.trim();
    }
    if (!resolvedShippingAddress || resolvedShippingAddress.length < 5) {
      throw new OrderServiceError(
        "INVALID_ARGUMENT",
        "Valid shipping address (min 5 characters) is required for new customer."
      );
    }
  } else {
    throw new OrderServiceError(
      "INVALID_ARGUMENT",
      "Either an existing customerId or newCustomer details (newCustomerName and shippingAddress) must be provided."
    );
  }

  // 4. Resolve Products, Compare Prices, and Verify Stock
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
      throw new OrderServiceError(
        "PRODUCT_NOT_FOUND",
        `Product '${item.productId}' does not exist in this catalog.`,
        { productId: item.productId }
      );
    }

    if (!prod.isActive) {
      throw new OrderServiceError(
        "PRODUCT_NOT_FOUND",
        `Product '${prod.name}' (SKU: ${prod.sku}) is currently inactive and cannot be ordered.`,
        { productId: prod.id, sku: prod.sku }
      );
    }

    const currentCatalogPrice = parseFloat(prod.sellingPrice || "0");

    // Price verification check
    if (item.unitPrice !== undefined && item.unitPrice !== null) {
      if (Math.abs(item.unitPrice - currentCatalogPrice) > 0.001) {
        throw new OrderServiceError(
          "PRICE_CHANGED",
          `Price mismatch for product '${prod.name}' (SKU: ${prod.sku}). Client expected unit price ₹${item.unitPrice}, but current database catalog price is ₹${currentCatalogPrice}.`,
          {
            productId: prod.id,
            sku: prod.sku,
            clientUnitPrice: item.unitPrice,
            currentSellingPrice: currentCatalogPrice,
          }
        );
      }
    }

    // Available stock check: Available = Physical - Reserved
    const availableStock = prod.physicalStock - prod.reservedStock;
    if (availableStock < item.quantity) {
      throw new OrderServiceError(
        "INSUFFICIENT_STOCK",
        `Insufficient available stock for SKU ${prod.sku} (${prod.name}). Requested: ${item.quantity}, Available: ${availableStock} (Physical: ${prod.physicalStock}, Reserved: ${prod.reservedStock}).`,
        {
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          requestedQuantity: item.quantity,
          availableStock,
          physicalStock: prod.physicalStock,
          reservedStock: prod.reservedStock,
        }
      );
    }

    const unitPriceNum = currentCatalogPrice;
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

  // 5. Payment Verification & Reported Status Handling
  let finalPaymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
  let internalNotes = params.notes || "";
  const paymentMethod = params.paymentMethod || "Cash on Delivery";

  if (params.paymentStatus === "PAID") {
    if (params.paymentReference && params.paymentReference.trim().length > 0) {
      // Verified payment with transaction proof/reference
      finalPaymentStatus = "PAID";
      internalNotes = `[VERIFIED PAYMENT] Ref: ${params.paymentReference.trim()} via ${paymentMethod}. ${internalNotes}`.trim();
    } else if (params.paymentReportedByCustomer) {
      // Customer reports paid (e.g. via UPI), but independent verification is pending
      finalPaymentStatus = "UNPAID";
      internalNotes = `[PAYMENT REPORTED BY CUSTOMER - PENDING VERIFICATION] Customer reported payment via ${paymentMethod}. Verification required before fulfillment. ${internalNotes}`.trim();
    } else if (params.confirmed) {
      // Explicit operator confirmation to record as paid
      finalPaymentStatus = "PAID";
      internalNotes = `[OPERATOR CONFIRMED PAYMENT] Marked PAID by operator via ${paymentMethod}. ${internalNotes}`.trim();
    } else {
      throw new OrderServiceError(
        "PAYMENT_VERIFICATION_REQUIRED",
        `Payment status 'PAID' requires an independent payment verification reference (paymentReference) or explicit operator confirmation. For unverified customer reports, specify paymentReportedByCustomer: true to record as pending verification.`,
        { paymentStatus: "PAID", paymentMethod }
      );
    }
  } else if (params.paymentStatus === "PARTIALLY_PAID") {
    finalPaymentStatus = "PARTIALLY_PAID";
  }

  const orderDiscountNum = params.orderDiscount || 0;
  const shippingFeeNum = params.shippingFee || 0;
  const totalAmountNum = Math.max(0, subtotalNum - orderDiscountNum + shippingFeeNum);

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const orderNumber = await generateOrderNumber(params.workspaceId);

  // 6. Execute Everything Atomically in a Database Transaction
  const responseResult = await (db as any).transaction(async (tx: any) => {
    // A. Create new customer if needed
    if (!resolvedCustomerId && params.newCustomer) {
      const newCustId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await tx.insert(customers).values({
        id: newCustId,
        workspaceId: params.workspaceId,
        name: params.newCustomer.name.trim(),
        phone: params.newCustomer.phone?.trim() || null,
        email: params.newCustomer.email?.trim() || null,
        shippingAddress: resolvedShippingAddress,
        notes: params.newCustomer.notes?.trim() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      resolvedCustomerId = newCustId;
    }

    // B. Concurrency-safe Stock Reservation
    try {
      await reserveStockForOrder({
        workspaceId: params.workspaceId,
        orderId,
        orderNumber,
        items: params.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        actor: params.actor,
        tx,
      });
    } catch (err: any) {
      if (err.message && err.message.includes("Insufficient available stock")) {
        throw new OrderServiceError("INSUFFICIENT_STOCK", err.message);
      }
      throw err;
    }

    // C. Insert Order Record
    await tx.insert(orders).values({
      id: orderId,
      workspaceId: params.workspaceId,
      orderNumber,
      customerId: resolvedCustomerId,
      shippingAddress: resolvedShippingAddress,
      source: params.source || "WhatsApp",
      status: "CONFIRMED", // Confirmed with stock reserved
      subtotal: subtotalNum.toFixed(2),
      discount: orderDiscountNum.toFixed(2),
      shippingFee: shippingFeeNum.toFixed(2),
      totalAmount: totalAmountNum.toFixed(2),
      paymentStatus: finalPaymentStatus,
      paymentMethod,
      packingNotes: params.packingNotes || null,
      notes: internalNotes || null,
      idempotencyKey: params.idempotencyKey || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // D. Insert Order Items
    for (const it of resolvedItems) {
      const itemId = `oi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await tx.insert(orderItems).values({
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

    // E. Insert Order Status History
    await tx.insert(orderStatusHistory).values({
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

    // F. Record Verified Payment if applicable
    if (finalPaymentStatus === "PAID" && (params.paymentReference || params.initialPaymentAmount)) {
      const payAmount = (params.initialPaymentAmount || totalAmountNum).toFixed(2);
      await tx.insert(payments).values({
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: params.workspaceId,
        orderId,
        amount: payAmount,
        paymentMethod,
        reference: params.paymentReference || "Verified at order creation",
        notes: internalNotes,
        createdAt: new Date(),
      });
    }

    const orderOutput = {
      orderId,
      orderNumber,
      customerId: resolvedCustomerId,
      shippingAddress: resolvedShippingAddress,
      status: "CONFIRMED",
      subtotal: subtotalNum.toFixed(2),
      discount: orderDiscountNum.toFixed(2),
      shippingFee: shippingFeeNum.toFixed(2),
      totalAmount: totalAmountNum.toFixed(2),
      paymentStatus: finalPaymentStatus,
      paymentMethod,
      items: resolvedItems,
      inventoryReserved: true,
    };

    // G. Store Idempotency Record
    if (params.idempotencyKey) {
      await tx.insert(idempotencyRecords).values({
        id: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: params.workspaceId,
        idempotencyKey: params.idempotencyKey,
        operation: "CREATE_ORDER",
        responseStatus: 201,
        responseBody: JSON.stringify(orderOutput),
        createdAt: new Date(),
      });
    }

    return orderOutput;
  });

  // 7. Post-Commit Audit Log & MCP Events
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
      paymentStatus: finalPaymentStatus,
    },
    outcome: "SUCCESS",
    idempotencyKey: params.idempotencyKey || null,
  });

  dispatchMcpEvent(params.workspaceId, "order.created", {
    order_id: orderId,
    order_number: orderNumber,
    customer_id: resolvedCustomerId,
    customer_name: params.newCustomer?.name || "Customer",
    total_amount: totalAmountNum,
    status: "CONFIRMED",
    payment_status: finalPaymentStatus,
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
  cancellationReason?: string | null;
  cancellationFee?: number | null;
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
    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      previousStatus: prevStatus,
      currentStatus: prevStatus,
      status: prevStatus,
      message: "Status already set",
    };
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

  let calculatedCancellationFee = 0;
  let calculatedRefundAmount = 0;
  let cancellationReasonStr: string | null = null;

  // Handle Cancellation Logic (Deductions & Inventory Restock Policy)
  if (params.newStatus === "CANCELLED") {
    // 1. Fetch workspace cancellation deduction policy
    const [ws] = await (db as any)
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, params.workspaceId))
      .limit(1);

    const totalAmount = parseFloat(order.totalAmount || "0");

    if (params.cancellationFee !== undefined && params.cancellationFee !== null) {
      calculatedCancellationFee = Math.max(0, Math.min(totalAmount, Number(params.cancellationFee)));
    } else if (ws) {
      const deductionType = ws.cancellationDeductionType || "PERCENTAGE";
      const deductionVal = parseFloat(ws.cancellationDeductionValue || "0");

      if (deductionType === "PERCENTAGE") {
        calculatedCancellationFee = Math.round((totalAmount * (deductionVal / 100)) * 100) / 100;
      } else if (deductionType === "FIXED") {
        calculatedCancellationFee = Math.min(totalAmount, Math.max(0, deductionVal));
      } else {
        calculatedCancellationFee = 0;
      }
    }

    calculatedRefundAmount = Math.max(0, Math.round((totalAmount - calculatedCancellationFee) * 100) / 100);
    cancellationReasonStr = params.cancellationReason || params.note || "Order cancelled";

    // 2. Apply Restock Policy
    const restockPolicy = ws?.cancellationRestockPolicy || "RELEASE_TO_AVAILABLE";
    if (["NEW", "CONFIRMED", "PROCESSING", "PACKED"].includes(prevStatus)) {
      if (restockPolicy === "RELEASE_TO_AVAILABLE") {
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
          reason: `Order ${order.orderNumber} cancelled by ${params.actor.name} (Policy: Released to Available Stock)`,
        });
      }
    }
  }

  // Update order status and cancellation amounts if applicable
  const orderUpdatePayload: Record<string, any> = {
    status: params.newStatus,
    updatedAt: new Date(),
  };

  if (params.newStatus === "CANCELLED") {
    orderUpdatePayload.cancellationFee = calculatedCancellationFee.toFixed(2);
    orderUpdatePayload.cancellationReason = cancellationReasonStr;
    orderUpdatePayload.refundAmount = calculatedRefundAmount.toFixed(2);
  }

  await (db as any)
    .update(orders)
    .set(orderUpdatePayload)
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
    note:
      params.note ||
      (params.newStatus === "CANCELLED"
        ? `Order cancelled. Deduction fee: ₹${calculatedCancellationFee.toFixed(2)}, Net refund: ₹${calculatedRefundAmount.toFixed(2)}`
        : `Status transition: ${prevStatus} -> ${params.newStatus}`),
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
    afterState: {
      status: params.newStatus,
      ...(params.newStatus === "CANCELLED"
        ? {
            cancellationFee: calculatedCancellationFee.toFixed(2),
            refundAmount: calculatedRefundAmount.toFixed(2),
            reason: cancellationReasonStr,
          }
        : {}),
    },
    outcome: "SUCCESS",
  });

  // Dispatch MCP Event: order.status_changed
  dispatchMcpEvent(params.workspaceId, "order.status_changed", {
    order_id: order.id,
    order_number: order.orderNumber,
    previous_status: prevStatus,
    current_status: params.newStatus,
    ...(params.newStatus === "CANCELLED"
      ? {
          cancellation_fee: calculatedCancellationFee.toFixed(2),
          refund_amount: calculatedRefundAmount.toFixed(2),
          cancellation_reason: cancellationReasonStr,
        }
      : {}),
    url: `${getBaseUrl()}/orders#${order.id}`,
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    previousStatus: prevStatus,
    currentStatus: params.newStatus,
    ...(params.newStatus === "CANCELLED"
      ? {
          cancellationFee: calculatedCancellationFee.toFixed(2),
          refundAmount: calculatedRefundAmount.toFixed(2),
          cancellationReason: cancellationReasonStr,
        }
      : {}),
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
