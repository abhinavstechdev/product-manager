import { getDb } from "../db/client";
import { products, categories, inventoryTransactions } from "../db/schema";
import { eq, and, sql, desc, or, ilike } from "drizzle-orm";
import { StockActor } from "./inventory-service";
import { logAuditEvent } from "../audit/audit-service";

export async function listProducts(workspaceId: string, options?: {
  categoryId?: string;
  lowStockOnly?: boolean;
  search?: string;
  activeOnly?: boolean;
}) {
  const db = await getDb();

  const query = (db as any)
    .select({
      product: products,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.workspaceId, workspaceId))
    .orderBy(desc(products.createdAt));

  const rows = await query;

  let result = rows.map((r: any) => ({
    ...r.product,
    categoryName: r.categoryName || "Uncategorized",
    availableStock: r.product.physicalStock - r.product.reservedStock,
  }));

  if (options?.activeOnly !== false) {
    result = result.filter((p: any) => p.isActive);
  }

  if (options?.categoryId) {
    result = result.filter((p: any) => p.categoryId === options.categoryId);
  }

  if (options?.lowStockOnly) {
    result = result.filter((p: any) => p.availableStock <= p.reorderThreshold);
  }

  if (options?.search) {
    const s = options.search.toLowerCase();
    result = result.filter(
      (p: any) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        (p.barcode && p.barcode.toLowerCase().includes(s))
    );
  }

  return result;
}

export async function createProduct(params: {
  workspaceId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  purchaseCost: number;
  sellingPrice: number;
  initialStock?: number;
  reorderThreshold?: number;
  actor: StockActor;
}) {
  const db = await getDb();

  // SKU unique check per workspace
  const [existingSku] = await (db as any)
    .select()
    .from(products)
    .where(and(eq(products.workspaceId, params.workspaceId), eq(products.sku, params.sku.toUpperCase())))
    .limit(1);

  if (existingSku) {
    throw new Error(`SKU "${params.sku}" is already in use in this workspace.`);
  }

  const productId = `prd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initialStock = params.initialStock || 0;
  const now = new Date();

  await (db as any).insert(products).values({
    id: productId,
    workspaceId: params.workspaceId,
    name: params.name,
    sku: params.sku.toUpperCase(),
    barcode: params.barcode || null,
    categoryId: params.categoryId || null,
    description: params.description || null,
    imageUrl: params.imageUrl || null,
    purchaseCost: params.purchaseCost.toFixed(2),
    sellingPrice: params.sellingPrice.toFixed(2),
    physicalStock: initialStock,
    reservedStock: 0,
    reorderThreshold: params.reorderThreshold || 10,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  if (initialStock > 0) {
    await (db as any).insert(inventoryTransactions).values({
      id: `tx_init_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: params.workspaceId,
      productId,
      changeQty: initialStock,
      prevQty: 0,
      newQty: initialStock,
      transactionType: "OPENING_STOCK",
      reason: "Initial product stock onboarding",
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorType: params.actor.type,
      createdAt: now,
    });
  }

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "create_product" : null,
    operation: "CREATE_PRODUCT",
    targetRecord: params.sku.toUpperCase(),
    afterState: { productId, name: params.name, sku: params.sku, initialStock },
    outcome: "SUCCESS",
  });

  return {
    id: productId,
    name: params.name,
    sku: params.sku.toUpperCase(),
    physicalStock: initialStock,
    availableStock: initialStock,
    sellingPrice: params.sellingPrice.toFixed(2),
  };
}

export async function updateProduct(params: {
  workspaceId: string;
  productId: string;
  name?: string;
  sku?: string;
  barcode?: string | null;
  categoryId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  purchaseCost?: number;
  sellingPrice?: number;
  reorderThreshold?: number;
  isActive?: boolean;
  actor: StockActor;
}) {
  const db = await getDb();

  const [product] = await (db as any)
    .select()
    .from(products)
    .where(and(eq(products.id, params.productId), eq(products.workspaceId, params.workspaceId)))
    .limit(1);

  if (!product) {
    throw new Error(`Product not found: ${params.productId}`);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (params.name !== undefined) updates.name = params.name;
  if (params.sku !== undefined) updates.sku = params.sku.toUpperCase();
  if (params.barcode !== undefined) updates.barcode = params.barcode;
  if (params.categoryId !== undefined) updates.categoryId = params.categoryId;
  if (params.description !== undefined) updates.description = params.description;
  if (params.imageUrl !== undefined) updates.imageUrl = params.imageUrl;
  if (params.purchaseCost !== undefined) updates.purchaseCost = params.purchaseCost.toFixed(2);
  if (params.sellingPrice !== undefined) updates.sellingPrice = params.sellingPrice.toFixed(2);
  if (params.reorderThreshold !== undefined) updates.reorderThreshold = params.reorderThreshold;
  if (params.isActive !== undefined) updates.isActive = params.isActive;

  await (db as any).update(products).set(updates).where(eq(products.id, product.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "update_product" : null,
    operation: "UPDATE_PRODUCT",
    targetRecord: product.sku,
    beforeState: product,
    afterState: updates,
    outcome: "SUCCESS",
  });

  return { success: true, productId: product.id };
}

export async function listCategories(workspaceId: string) {
  const db = await getDb();
  return await (db as any)
    .select()
    .from(categories)
    .where(eq(categories.workspaceId, workspaceId))
    .orderBy(desc(categories.createdAt));
}

export async function createCategory(params: {
  workspaceId: string;
  name: string;
  description?: string | null;
}) {
  const db = await getDb();
  const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await (db as any).insert(categories).values({
    id,
    workspaceId: params.workspaceId,
    name: params.name,
    description: params.description || null,
    isActive: true,
    createdAt: new Date(),
  });
  return { id, name: params.name };
}
