import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as confirmationService from "@/lib/services/confirmation-service";
import { getDb } from "@/lib/db/client";
import { pendingConfirmations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const list = await confirmationService.listPendingConfirmations(session.workspaceId);
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { confirmationId, action } = body; // action: "APPROVE" | "REJECT"

    const db = await getDb();
    const status = action === "APPROVE" ? "APPROVED" : "REJECTED";

    await (db as any)
      .update(pendingConfirmations)
      .set({ status })
      .where(eq(pendingConfirmations.id, confirmationId));

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
