import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as paymentService from "@/lib/services/payment-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const payments = await paymentService.listPayments(session.workspaceId);
    const summary = await paymentService.getPaymentSummary(session.workspaceId);
    return NextResponse.json({ payments, summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const result = await paymentService.recordPayment({
      workspaceId: session.workspaceId,
      orderId: body.orderId,
      amount: parseFloat(body.amount),
      paymentMethod: body.paymentMethod,
      reference: body.reference || null,
      notes: body.notes || null,
      idempotencyKey: body.idempotencyKey || null,
      actor: { id: session.userId, name: session.name, type: "USER" },
      sourceType: "web",
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
