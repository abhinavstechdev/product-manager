import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { orders, orderItems, customers, workspaces, payments, products } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { amountToWordsINR } from "@/lib/utils/format";
import { getBaseUrl } from "@/lib/config/urls";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : await (params as any);
    let orderParam = resolvedParams?.id;
    if (!orderParam || orderParam === "undefined") {
      const urlParts = new URL(request.url).pathname.split("/");
      orderParam = urlParts[urlParts.length - 1];
    }

    if (!orderParam || orderParam === "undefined") {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const db = await getDb();

    // Query order by id or orderNumber
    const [orderRow] = await (db as any)
      .select({
        order: orders,
        customer: customers,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(or(eq(orders.id, orderParam), eq(orders.orderNumber, orderParam)))
      .limit(1);

    if (!orderRow) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRow.order;
    const customer = orderRow.customer;

    // Fetch line items
    const items = await (db as any)
      .select({
        item: orderItems,
        product: {
          id: products.id,
          imageUrl: products.imageUrl,
          barcode: products.barcode,
        },
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id));

    // Fetch payments
    const orderPayments = await (db as any)
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt));

    // Fetch workspace company settings
    const [ws] = await (db as any)
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, order.workspaceId))
      .limit(1);

    const baseUrl = getBaseUrl(request);
    const invoicePrefix = ws?.invoicePrefix || "INV";
    const invoiceNumber = `${invoicePrefix}-${order.orderNumber}`;
    const amountInWords = amountToWordsINR(order.totalAmount);

    const company = {
      name: ws?.companyName || ws?.name || "Apex Logistics",
      address: ws?.companyAddress || "Plot 42, Electronic City Phase 1, Hosur Road, Bengaluru, Karnataka - 560100, India",
      phone: ws?.companyPhone || "+91 98765 43210",
      email: ws?.companyEmail || "billing@apexlogistics.in",
      taxId: ws?.companyTaxId || "GSTIN: 29ABCDE1234F1Z5",
      logoUrl: ws?.companyLogoUrl || "",
      website: ws?.companyWebsite || baseUrl,
      invoicePrefix,
      footerNotes:
        ws?.invoiceFooterNotes ||
        "1. This is a computer-generated tax invoice and requires no physical signature.\n2. Goods once sold can be returned within 7 days in original condition with QC verification.\n3. All disputes subject to local jurisdiction.",
      timezone: ws?.timezone || "Asia/Kolkata",
      currency: ws?.currency || "INR",
    };

    return NextResponse.json({
      success: true,
      invoiceNumber,
      digitalBillUrl: `${baseUrl}/bill/${order.id}`,
      amountInWords,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        source: order.source,
        shippingAddress: order.shippingAddress,
        subtotal: order.subtotal,
        discount: order.discount,
        shippingFee: order.shippingFee,
        totalAmount: order.totalAmount,
        notes: order.notes,
        createdAt: order.createdAt,
      },
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.shippingAddress || order.shippingAddress,
          }
        : {
            name: "Direct Customer",
            phone: "—",
            email: "—",
            address: order.shippingAddress,
          },
      items: items.map((i: any) => ({
        id: i.item.id,
        productId: i.item.productId,
        sku: i.item.sku,
        productName: i.item.productName,
        quantity: i.item.quantity,
        unitPrice: i.item.unitPrice,
        discount: i.item.discount,
        totalPrice: i.item.totalPrice,
      })),
      payments: orderPayments,
      company,
    });
  } catch (err: any) {
    console.error("Error in GET /api/bill/[id]:", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
