import { getDb } from "../db/client";
import { pendingConfirmations } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { logAuditEvent } from "../audit/audit-service";

export interface CreatePendingConfirmationParams {
  workspaceId: string;
  clientId: string;
  toolName: string;
  parameters: Record<string, any>;
  riskLevel: "MODERATE" | "HIGH";
  description: string;
}

export async function createPendingConfirmation(params: CreatePendingConfirmationParams) {
  const db = await getDb();
  const id = `conf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const token = `cfm_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes TTL

  await (db as any).insert(pendingConfirmations).values({
    id,
    workspaceId: params.workspaceId,
    clientId: params.clientId,
    toolName: params.toolName,
    parameters: JSON.stringify(params.parameters),
    riskLevel: params.riskLevel,
    description: params.description,
    status: "PENDING",
    confirmationToken: token,
    expiresAt,
    createdAt: now,
  });

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.clientId,
    actorName: "AI Assistant",
    actorType: "AI_CLIENT",
    toolName: params.toolName,
    operation: "REQUIRE_CONFIRMATION",
    targetRecord: id,
    beforeState: null,
    afterState: { token, description: params.description },
    outcome: "CONFIRMATION_REQUIRED",
    confirmationRef: token,
  });

  return {
    confirmationRequired: true,
    confirmationToken: token,
    expiresAt,
    description: params.description,
    instruction: `This action requires confirmation. You may present this confirmation request to the user with token '${token}', or the user can approve it on the AI Activity dashboard. Re-execute the tool with confirmationToken: '${token}' to proceed once authorized.`,
  };
}

export async function verifyAndConsumeConfirmation(workspaceId: string, confirmationToken: string, toolName: string) {
  const db = await getDb();

  const [conf] = await (db as any)
    .select()
    .from(pendingConfirmations)
    .where(
      and(
        eq(pendingConfirmations.workspaceId, workspaceId),
        eq(pendingConfirmations.confirmationToken, confirmationToken)
      )
    )
    .limit(1);

  if (!conf) {
    throw new Error("Invalid or unrecognized confirmation token.");
  }

  if (conf.status === "APPROVED" || conf.status === "PENDING") {
    // Check expiration
    if (new Date() > new Date(conf.expiresAt)) {
      await (db as any)
        .update(pendingConfirmations)
        .set({ status: "EXPIRED" })
        .where(eq(pendingConfirmations.id, conf.id));
      throw new Error("Confirmation token has expired. Please re-initiate the action.");
    }

    if (conf.toolName !== toolName) {
      throw new Error(`Confirmation token was generated for tool '${conf.toolName}', but attempted on '${toolName}'.`);
    }

    // Mark consumed/approved
    await (db as any)
      .update(pendingConfirmations)
      .set({ status: "APPROVED" })
      .where(eq(pendingConfirmations.id, conf.id));

    return JSON.parse(conf.parameters);
  }

  throw new Error(`Confirmation request cannot be executed because status is '${conf.status}'.`);
}

export async function listPendingConfirmations(workspaceId: string) {
  const db = await getDb();
  return await (db as any)
    .select()
    .from(pendingConfirmations)
    .where(and(eq(pendingConfirmations.workspaceId, workspaceId), eq(pendingConfirmations.status, "PENDING")))
    .orderBy(desc(pendingConfirmations.createdAt));
}
