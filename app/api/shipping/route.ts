import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as shippingService from "@/lib/services/shipping-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const queue = await shippingService.listOrdersToShip(session.workspaceId);
    const shipments = await shippingService.listShipments(session.workspaceId);
    return NextResponse.json({ queue, shipments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    if (body.action === "DELIVER") {
      const result = await shippingService.markOrderDelivered({
        workspaceId: session.workspaceId,
        orderId: body.orderId,
        notes: body.notes || null,
        actor: { id: session.userId, name: session.name, type: "USER" },
        sourceType: "web",
      });
      return NextResponse.json(result);
    }

    const result = await shippingService.markOrderShipped({
      workspaceId: session.workspaceId,
      orderId: body.orderId,
      courier: body.courier,
      trackingNumber: body.trackingNumber,
      expectedDeliveryDays: body.expectedDeliveryDays ? parseInt(body.expectedDeliveryDays, 10) : 3,
      notes: body.notes || null,
      actor: { id: session.userId, name: session.name, type: "USER" },
      sourceType: "web",
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
