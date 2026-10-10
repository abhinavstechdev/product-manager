import { getDb } from "../db/client";
import { orders, payments, idempotencyRecords } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { StockActor } from "./inventory-service";
import { logAuditEvent } from "../audit/audit-service";

export async function recordPayment(params: {
  workspaceId: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  actor: StockActor;
  sourceType: "web" | "mcp";
}) {
  const db = await getDb();

  // 1. Idempotency Check
  if (params.idempotencyKey) {
    const [existing] = await (db as any)
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.workspaceId, params.workspaceId),
          eq(idempotencyRecords.idempotencyKey, params.idempotencyKey)
        )
      )
      .limit(1);

    if (existing) {
      return JSON.parse(existing.responseBody);
    }
  }

  // 2. Fetch order
  const [order] = await (db as any)
    .select()
    .from(orders)
    .where(and(eq(orders.id, params.orderId), eq(orders.workspaceId, params.workspaceId)))
    .limit(1);

  if (!order) {
    throw new Error(`Order not found: ${params.orderId}`);
  }

  if (params.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  // 3. Calculate previous payments and remaining balance
  const existingPayments = await (db as any)
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id));

  const totalPaidPreviously = existingPayments.reduce(
    (sum: number, p: any) => sum + parseFloat(p.amount),
    0
  );

  const orderTotal = parseFloat(order.totalAmount);
  const remainingBefore = Math.max(0, orderTotal - totalPaidPreviously);

  if (params.amount > remainingBefore) {
    throw new Error(
      `Payment amount ₹${params.amount.toFixed(2)} exceeds remaining balance ₹${remainingBefore.toFixed(2)} (Order total: ₹${orderTotal.toFixed(2)}, Already paid: ₹${totalPaidPreviously.toFixed(2)})`
    );
  }

  const newTotalPaid = totalPaidPreviously + params.amount;
  const remainingAfter = Math.max(0, orderTotal - newTotalPaid);

  let newPaymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "PARTIALLY_PAID";
  if (newTotalPaid >= orderTotal) {
    newPaymentStatus = "PAID";
  } else if (newTotalPaid <= 0) {
    newPaymentStatus = "UNPAID";
  }

  // 4. Insert Payment record
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await (db as any).insert(payments).values({
    id: paymentId,
    workspaceId: params.workspaceId,
    orderId: order.id,
    amount: params.amount.toFixed(2),
    paymentMethod: params.paymentMethod,
    reference: params.reference || null,
    notes: params.notes || null,
    idempotencyKey: params.idempotencyKey || null,
    createdAt: new Date(),
  });

  // 5. Update Order payment status
  await (db as any)
    .update(orders)
    .set({
      paymentStatus: newPaymentStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // 6. Audit log
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.sourceType === "mcp" ? "record_payment" : null,
    operation: "RECORD_PAYMENT",
    targetRecord: order.orderNumber,
    beforeState: { paymentStatus: order.paymentStatus, totalPaid: totalPaidPreviously },
    afterState: { paymentStatus: newPaymentStatus, totalPaid: newTotalPaid, paymentId },
    outcome: "SUCCESS",
    idempotencyKey: params.idempotencyKey || null,
  });

  const responseResult = {
    paymentId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountPaid: params.amount.toFixed(2),
    paymentMethod: params.paymentMethod,
    orderTotal: orderTotal.toFixed(2),
    totalPaid: newTotalPaid.toFixed(2),
    remainingBalance: remainingAfter.toFixed(2),
    paymentStatus: newPaymentStatus,
  };

  // 7. Save Idempotency Record
  if (params.idempotencyKey) {
    await (db as any).insert(idempotencyRecords).values({
      id: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: params.workspaceId,
      idempotencyKey: params.idempotencyKey,
      operation: "RECORD_PAYMENT",
      responseStatus: 200,
      responseBody: JSON.stringify(responseResult),
      createdAt: new Date(),
    });
  }

  return responseResult;
}

export async function listPayments(workspaceId: string, limit: number = 50) {
  const db = await getDb();
  return await (db as any)
    .select({
      payment: payments,
      orderNumber: orders.orderNumber,
      orderTotal: orders.totalAmount,
    })
    .from(payments)
    .leftJoin(orders, eq(payments.orderId, orders.id))
    .where(eq(payments.workspaceId, workspaceId))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function getPaymentSummary(workspaceId: string) {
  const db = await getDb();

  const allOrders = await (db as any)
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.workspaceId, workspaceId));

  const allPayments = await (db as any)
    .select({
      amount: payments.amount,
    })
    .from(payments)
    .where(eq(payments.workspaceId, workspaceId));

  let totalCollected = 0;
  for (const p of allPayments) {
    totalCollected += parseFloat(p.amount);
  }

  let totalGrossOrderValue = 0;
  let unpaidCount = 0;
  let partialCount = 0;
  let paidCount = 0;

  for (const o of allOrders) {
    const val = parseFloat(o.totalAmount);
    totalGrossOrderValue += val;
    if (o.paymentStatus === "UNPAID") unpaidCount++;
    else if (o.paymentStatus === "PARTIALLY_PAID") partialCount++;
    else if (o.paymentStatus === "PAID") paidCount++;
  }

  const outstandingBalance = Math.max(0, totalGrossOrderValue - totalCollected);

  return {
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalGrossOrderValue: Math.round(totalGrossOrderValue * 100) / 100,
    outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    unpaidCount,
    partialCount,
    paidCount,
  };
}
