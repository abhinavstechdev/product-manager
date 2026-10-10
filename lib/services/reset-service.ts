import { getDb } from "../db/client";
import {
  orderStatusHistory,
  shipments,
  returnItems,
  returns,
  payments,
  orderItems,
  orders,
  inventoryTransactions,
  pendingConfirmations,
  products,
  categories,
  customers,
} from "../db/schema";
import { logAuditEvent } from "../audit/audit-service";
import { StockActor } from "./inventory-service";

export const MASTER_RESET_PASSWORD = process.env.FACTORY_RESET_PASSWORD || "Aezakmi@ff135";

export interface FactoryResetParams {
  workspaceId: string;
  password?: string;
  confirmed?: boolean;
  actor: StockActor;
}

export async function executeFactoryReset(params: FactoryResetParams) {
  // 1. Password Verification
  if (!params.password) {
    return {
      success: false,
      status: "PASSWORD_REQUIRED",
      message:
        "SECURITY AUTHORIZATION REQUIRED: Factory reset cannot proceed without the master security password. The AI assistant must prompt the operator to supply the reset password ('Aezakmi@ff135') before invoking this tool.",
    };
  }

  const cleanPassword = params.password.trim();
  if (cleanPassword !== MASTER_RESET_PASSWORD) {
    return {
      success: false,
      status: "INVALID_PASSWORD",
      message:
        "SECURITY REJECTION: The security password provided for factory reset is incorrect. Operation aborted.",
    };
  }

  // 2. Once the correct master password ("Aezakmi@ff135") is supplied, execute the reset immediately
  const db = await getDb();
  const workspaceId = params.workspaceId;
  const now = new Date();

  // Purge all transactional, catalog, and customer data in foreign-key safe order
  await (db as any).delete(orderStatusHistory);
  await (db as any).delete(shipments);
  await (db as any).delete(returnItems);
  await (db as any).delete(returns);
  await (db as any).delete(payments);
  await (db as any).delete(orderItems);
  await (db as any).delete(orders);
  await (db as any).delete(inventoryTransactions);
  await (db as any).delete(pendingConfirmations);
  await (db as any).delete(products);
  await (db as any).delete(categories);
  await (db as any).delete(customers);

  // Log audit event
  await logAuditEvent({
    workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: "factory_reset",
    operation: "FACTORY_RESET",
    targetRecord: workspaceId,
    beforeState: null,
    afterState: { cleanSlate: true, fakeData: false },
    outcome: "SUCCESS",
  });

  return {
    success: true,
    status: "COMPLETED",
    message:
      "FACTORY RESET COMPLETE: The website and platform have been completely reset to a clean, fresh state. All products, categories, customers, orders, shipments, payments, returns, and transactions have been permanently purged with zero fake data.",
    cleanSlate: true,
    timestamp: now.toISOString(),
  };
}
