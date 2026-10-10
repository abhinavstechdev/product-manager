import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as returnService from "@/lib/services/return-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const returnsList = await returnService.listReturns(session.workspaceId);
    return NextResponse.json(returnsList);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    if (body.action === "APPROVE") {
      const result = await returnService.approveReturn({
        workspaceId: session.workspaceId,
        returnId: body.returnId,
        refundAmount: body.refundAmount ? parseFloat(body.refundAmount) : 0,
        restockSellable: body.restockSellable !== false,
        notes: body.notes || null,
        actor: { id: session.userId, name: session.name, type: "USER" },
        sourceType: "web",
      });
      return NextResponse.json(result);
    }

    if (body.action === "REJECT") {
      const result = await returnService.rejectReturn({
        workspaceId: session.workspaceId,
        returnId: body.returnId,
        reason: body.reason,
        actor: { id: session.userId, name: session.name, type: "USER" },
        sourceType: "web",
      });
      return NextResponse.json(result);
    }

    const result = await returnService.registerReturn({
      workspaceId: session.workspaceId,
      orderId: body.orderId,
      reason: body.reason,
      items: body.items,
      notes: body.notes || null,
      actor: { id: session.userId, name: session.name, type: "USER" },
      sourceType: "web",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
