import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as inventoryService from "@/lib/services/inventory-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const summary = await inventoryService.getInventorySummary(session.workspaceId);
    const transactions = await inventoryService.listInventoryTransactions(session.workspaceId, 50);
    return NextResponse.json({ summary, transactions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const result = await inventoryService.adjustInventory({
      workspaceId: session.workspaceId,
      productId: body.productId,
      quantityChange: parseInt(body.quantityChange, 10),
      reason: body.reason,
      type: body.type,
      actor: { id: session.userId, name: session.name, type: "USER" },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
