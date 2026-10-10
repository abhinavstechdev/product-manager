import { getDb } from "../db/client";
import { auditEvents } from "../db/schema";

export interface LogAuditParams {
  workspaceId: string;
  actorId: string;
  actorName: string;
  actorType: "USER" | "AI_CLIENT" | "SYSTEM";
  toolName?: string | null;
  operation: string;
  targetRecord?: string | null;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  outcome: "SUCCESS" | "FAILURE" | "CONFIRMATION_REQUIRED";
  errorMessage?: string | null;
  idempotencyKey?: string | null;
  confirmationRef?: string | null;
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const db = await getDb();
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await (db as any).insert(auditEvents).values({
      id,
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorType: params.actorType,
      toolName: params.toolName || null,
      operation: params.operation,
      targetRecord: params.targetRecord || null,
      beforeState: params.beforeState ? JSON.stringify(params.beforeState) : null,
      afterState: params.afterState ? JSON.stringify(params.afterState) : null,
      outcome: params.outcome,
      errorMessage: params.errorMessage || null,
      idempotencyKey: params.idempotencyKey || null,
      confirmationRef: params.confirmationRef || null,
      createdAt: new Date(),
    });
  } catch (err) {
    // Audit logging should fail gracefully without crashing primary transaction, but log to stderr
    console.error("Failed to write audit event:", err);
  }
}
