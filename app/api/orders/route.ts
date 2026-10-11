import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as orderService from "@/lib/services/order-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const search = searchParams.get("search") || undefined;
    const orderId = searchParams.get("id") || undefined;

    if (orderId) {
      const order = await orderService.getOrderDetails(session.workspaceId, orderId);
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json(order);
    }

    const orders = await orderService.listOrders(session.workspaceId, {
      status,
      paymentStatus,
      search,
    });

    return NextResponse.json(orders);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const order = await orderService.createOrder({
      workspaceId: session.workspaceId,
      customerId: body.customerId || null,
      newCustomer: body.newCustomer || null,
      shippingAddress: body.shippingAddress,
      source: body.source || "Walk-in",
      items: body.items || [],
      orderDiscount: body.orderDiscount ? parseFloat(body.orderDiscount) : 0,
      shippingFee: body.shippingFee ? parseFloat(body.shippingFee) : 0,
      paymentMethod: body.paymentMethod || "Cash on Delivery",
      paymentStatus: body.paymentStatus || "UNPAID",
      initialPaymentAmount: body.initialPaymentAmount ? parseFloat(body.initialPaymentAmount) : 0,
      packingNotes: body.packingNotes || null,
      notes: body.notes || null,
      idempotencyKey: body.idempotencyKey || null,
      actor: { id: session.userId, name: session.name, type: "USER" },
      sourceType: "web",
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const result = await orderService.updateOrderStatus({
      workspaceId: session.workspaceId,
      orderId: body.orderId,
      newStatus: body.newStatus,
      note: body.note || null,
      cancellationReason: body.cancellationReason || null,
      cancellationFee: body.cancellationFee !== undefined ? parseFloat(body.cancellationFee) : undefined,
      actor: { id: session.userId, name: session.name, type: "USER" },
      sourceType: "web",
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
