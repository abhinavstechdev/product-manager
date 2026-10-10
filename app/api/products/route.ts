import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as productService from "@/lib/services/product-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const lowStockOnly = searchParams.get("lowStock") === "true";
    const categoryId = searchParams.get("categoryId") || undefined;

    const products = await productService.listProducts(session.workspaceId, {
      search,
      lowStockOnly,
      categoryId,
    });

    const categories = await productService.listCategories(session.workspaceId);

    return NextResponse.json({ products, categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const product = await productService.createProduct({
      workspaceId: session.workspaceId,
      name: body.name,
      sku: body.sku,
      barcode: body.barcode || null,
      categoryId: body.categoryId || null,
      description: body.description || null,
      imageUrl: body.imageUrl || null,
      purchaseCost: parseFloat(body.purchaseCost || "0"),
      sellingPrice: parseFloat(body.sellingPrice || "0"),
      initialStock: parseInt(body.initialStock || "0", 10),
      reorderThreshold: parseInt(body.reorderThreshold || "10", 10),
      actor: { id: session.userId, name: session.name, type: "USER" },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
