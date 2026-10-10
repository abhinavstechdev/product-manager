import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as customerService from "@/lib/services/customer-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const customerId = searchParams.get("id");

    if (customerId) {
      const cust = await customerService.getCustomer(session.workspaceId, customerId);
      if (!cust) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      return NextResponse.json(cust);
    }

    const customers = await customerService.listCustomers(session.workspaceId, search);
    return NextResponse.json(customers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const customer = await customerService.createCustomer({
      workspaceId: session.workspaceId,
      name: body.name,
      phone: body.phone || null,
      email: body.email || null,
      shippingAddress: body.shippingAddress,
      notes: body.notes || null,
      actor: { id: session.userId, name: session.name, type: "USER" },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
