import { getDb } from "../db/client";
import { customers, orders } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { StockActor } from "./inventory-service";
import { logAuditEvent } from "../audit/audit-service";

export async function listCustomers(workspaceId: string, search?: string) {
  const db = await getDb();
  let query = (db as any)
    .select()
    .from(customers)
    .where(eq(customers.workspaceId, workspaceId))
    .orderBy(desc(customers.createdAt));

  const list = await query;
  if (!search) return list;

  const s = search.toLowerCase();
  return list.filter(
    (c: any) =>
      c.name.toLowerCase().includes(s) ||
      (c.phone && c.phone.includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s))
  );
}

export async function getCustomer(workspaceId: string, customerId: string) {
  const db = await getDb();
  const [cust] = await (db as any)
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.workspaceId, workspaceId)))
    .limit(1);

  if (!cust) return null;

  const customerOrders = await (db as any)
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customerId), eq(orders.workspaceId, workspaceId)))
    .orderBy(desc(orders.createdAt));

  return {
    ...cust,
    orders: customerOrders,
  };
}

export async function createCustomer(params: {
  workspaceId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  shippingAddress: string;
  notes?: string | null;
  actor: StockActor;
}) {
  const db = await getDb();
  const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();

  await (db as any).insert(customers).values({
    id,
    workspaceId: params.workspaceId,
    name: params.name,
    phone: params.phone || null,
    email: params.email || null,
    shippingAddress: params.shippingAddress,
    notes: params.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "create_customer" : null,
    operation: "CREATE_CUSTOMER",
    targetRecord: params.name,
    afterState: { id, name: params.name, phone: params.phone },
    outcome: "SUCCESS",
  });

  return { id, name: params.name, shippingAddress: params.shippingAddress };
}

export async function updateCustomer(params: {
  workspaceId: string;
  customerId: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  shippingAddress?: string;
  notes?: string | null;
  actor: StockActor;
}) {
  const db = await getDb();

  const [cust] = await (db as any)
    .select()
    .from(customers)
    .where(and(eq(customers.id, params.customerId), eq(customers.workspaceId, params.workspaceId)))
    .limit(1);

  if (!cust) {
    throw new Error(`Customer not found: ${params.customerId}`);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (params.name !== undefined) updates.name = params.name;
  if (params.phone !== undefined) updates.phone = params.phone;
  if (params.email !== undefined) updates.email = params.email;
  if (params.shippingAddress !== undefined) updates.shippingAddress = params.shippingAddress;
  if (params.notes !== undefined) updates.notes = params.notes;

  await (db as any).update(customers).set(updates).where(eq(customers.id, cust.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "update_customer" : null,
    operation: "UPDATE_CUSTOMER",
    targetRecord: cust.name,
    beforeState: cust,
    afterState: updates,
    outcome: "SUCCESS",
  });

  return { success: true, customerId: cust.id };
}

export async function deleteCustomer(params: {
  workspaceId: string;
  customerId: string;
  actor: StockActor;
  force?: boolean;
}) {
  const db = await getDb();
  const [cust] = await (db as any)
    .select()
    .from(customers)
    .where(and(eq(customers.id, params.customerId), eq(customers.workspaceId, params.workspaceId)))
    .limit(1);

  if (!cust) {
    throw new Error(`Customer not found: "${params.customerId}"`);
  }

  // Check if active unfulfilled orders exist for this customer
  const activeOrders = await (db as any)
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, cust.id),
        eq(orders.workspaceId, params.workspaceId),
        sql`${orders.status} IN ('NEW', 'CONFIRMED', 'PROCESSING', 'PACKED')`
      )
    );

  if (activeOrders.length > 0 && !params.force) {
    const orderNumbers = activeOrders.map((o: any) => o.orderNumber).join(", ");
    throw new Error(
      `Cannot delete customer "${cust.name}" because they have active unfulfilled orders: ${orderNumbers}. Please cancel, fulfill, or delete those orders first.`
    );
  }

  // If force, delete customer's orders and cascade
  if (params.force) {
    const allCustomerOrders = await (db as any)
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.customerId, cust.id), eq(orders.workspaceId, params.workspaceId)));

    for (const o of allCustomerOrders) {
      await (db as any).delete(orders).where(eq(orders.id, o.id));
    }
  }

  // Delete customer
  await (db as any)
    .delete(customers)
    .where(eq(customers.id, cust.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "delete_customer" : null,
    operation: "DELETE_CUSTOMER",
    targetRecord: cust.name,
    beforeState: cust,
    afterState: null,
    outcome: "SUCCESS",
  });

  return { success: true, deletedId: cust.id, name: cust.name };
}
