import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as reportService from "@/lib/services/report-service";
import * as productService from "@/lib/services/product-service";
import * as orderService from "@/lib/services/order-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("export");

    if (exportType) {
      if (exportType === "inventory" || exportType === "products") {
        const prods = await productService.listProducts(session.workspaceId);
        const csv = reportService.generateCsv(
          prods.map((p: any) => ({
            SKU: p.sku,
            Name: p.name,
            Category: p.categoryName,
            PhysicalStock: p.physicalStock,
            ReservedStock: p.reservedStock,
            AvailableStock: p.availableStock,
            SellingPrice: p.sellingPrice,
            Cost: p.purchaseCost,
          }))
        );
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="inventory-report-${Date.now()}.csv"`,
          },
        });
      } else {
        const ords = await orderService.listOrders(session.workspaceId);
        const csv = reportService.generateCsv(
          ords.map((o: any) => ({
            OrderNumber: o.orderNumber,
            Customer: o.customerName || "",
            Status: o.status,
            TotalAmount: o.totalAmount,
            PaymentStatus: o.paymentStatus,
            Date: o.createdAt,
          }))
        );
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="orders-report-${Date.now()}.csv"`,
          },
        });
      }
    }

    const overview = await reportService.getDashboardOverview(session.workspaceId);
    const sales = await reportService.getSalesReport(session.workspaceId);
    const bestSelling = await reportService.getBestSellingProducts(session.workspaceId, 5);

    return NextResponse.json({ overview, sales, bestSelling });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
