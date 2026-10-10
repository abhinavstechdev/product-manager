import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as packingService from "@/lib/services/packing-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const slipId = searchParams.get("slip");

    if (slipId) {
      const slip = await packingService.getPackingSlip(session.workspaceId, slipId);
      return NextResponse.json(slip);
    }

    const queue = await packingService.listOrdersToPack(session.workspaceId);
    return NextResponse.json(queue);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const result = await packingService.markOrderPacked({
      workspaceId: session.workspaceId,
      orderId: body.orderId,
      packingNotes: body.packingNotes || null,
      actor: { id: session.userId, name: session.name, type: "USER" },
      sourceType: "web",
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
