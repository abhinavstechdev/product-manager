import { getDb } from "../db/client";
import { products, categories, inventoryTransactions, orders, orderItems } from "../db/schema";
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

export async function listCategories(workspaceId: string, options?: {
  includeProductCounts?: boolean;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  const rows = await (db as any)
    .select({
      id: categories.id,
      workspaceId: categories.workspaceId,
      name: categories.name,
      description: categories.description,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.workspaceId, workspaceId)))
    .where(eq(categories.workspaceId, workspaceId))
    .groupBy(categories.id)
    .orderBy(desc(categories.createdAt));

  let result = rows;
  if (options?.activeOnly) {
    result = result.filter((c: any) => c.isActive);
  }
  return result;
}

export async function createCategory(params: {
  workspaceId: string;
  name: string;
  description?: string | null;
  allowDuplicate?: boolean;
}) {
  const db = await getDb();
  const trimmedName = params.name.trim();

  if (!params.allowDuplicate) {
    const [existing] = await (db as any)
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.workspaceId, params.workspaceId),
          sql`lower(trim(${categories.name})) = ${trimmedName.toLowerCase()}`
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(`Category "${trimmedName}" already exists in this workspace (ID: ${existing.id}).`);
    }
  }

  const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await (db as any).insert(categories).values({
    id,
    workspaceId: params.workspaceId,
    name: trimmedName,
    description: params.description || null,
    isActive: true,
    createdAt: new Date(),
  });
  return { id, name: trimmedName, description: params.description || null };
}

export async function updateCategory(params: {
  workspaceId: string;
  categoryId: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
  actor: StockActor;
}) {
  const db = await getDb();
  const [category] = await (db as any)
    .select()
    .from(categories)
    .where(and(eq(categories.workspaceId, params.workspaceId), eq(categories.id, params.categoryId.trim())))
    .limit(1);

  if (!category) {
    throw new Error(`Category not found: "${params.categoryId}"`);
  }

  const updates: Record<string, any> = {};
  if (params.name !== undefined) {
    const trimmedName = params.name.trim();
    const [existing] = await (db as any)
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.workspaceId, params.workspaceId),
          sql`lower(trim(${categories.name})) = ${trimmedName.toLowerCase()}`,
          sql`${categories.id} != ${category.id}`
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(`Another category named "${trimmedName}" already exists in this workspace.`);
    }
    updates.name = trimmedName;
  }

  if (params.description !== undefined) {
    updates.description = params.description;
  }

  if (params.isActive !== undefined) {
    updates.isActive = params.isActive;
  }

  if (Object.keys(updates).length > 0) {
    await (db as any)
      .update(categories)
      .set(updates)
      .where(eq(categories.id, category.id));
  }

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "update_category" : null,
    operation: "UPDATE_CATEGORY",
    targetRecord: category.id,
    beforeState: category,
    afterState: { ...category, ...updates },
    outcome: "SUCCESS",
  });

  return {
    id: category.id,
    name: updates.name !== undefined ? updates.name : category.name,
    description: updates.description !== undefined ? updates.description : category.description,
    isActive: updates.isActive !== undefined ? updates.isActive : category.isActive,
  };
}

export async function updateProductCategory(params: {
  workspaceId: string;
  productIdOrSku: string;
  categoryId: string;
  actor: StockActor;
}) {
  const db = await getDb();
  const queryProduct = (params.productIdOrSku || "").trim();
  const targetCatId = (params.categoryId || "").trim();

  // 1. Resolve product
  const [product] = await (db as any)
    .select()
    .from(products)
    .where(
      and(
        eq(products.workspaceId, params.workspaceId),
        or(
          eq(products.id, queryProduct),
          eq(products.sku, queryProduct.toUpperCase())
        )
      )
    )
    .limit(1);

  if (!product) {
    throw new Error(`Product not found: "${params.productIdOrSku}" in this workspace.`);
  }

  // 2. Resolve category and enforce workspace isolation
  const [targetCategory] = await (db as any)
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, targetCatId),
        eq(categories.workspaceId, params.workspaceId)
      )
    )
    .limit(1);

  if (!targetCategory) {
    // Check if category belongs to another workspace to return clear error
    const [crossWsCat] = await (db as any)
      .select()
      .from(categories)
      .where(eq(categories.id, targetCatId))
      .limit(1);

    if (crossWsCat) {
      throw new Error(`Category "${targetCatId}" belongs to another workspace. Access denied.`);
    }
    throw new Error(`Category not found: "${targetCatId}".`);
  }

  // 3. Verify target category is active
  if (!targetCategory.isActive) {
    throw new Error(`Category "${targetCategory.name}" (${targetCategory.id}) is inactive and cannot receive products.`);
  }

  // 4. Resolve previous category for detailed response
  let prevCat: any = null;
  if (product.categoryId) {
    const [foundPrev] = await (db as any)
      .select()
      .from(categories)
      .where(eq(categories.id, product.categoryId))
      .limit(1);
    prevCat = foundPrev;
  }

  // 5. Update ONLY categoryId and updatedAt
  const now = new Date();
  await (db as any)
    .update(products)
    .set({
      categoryId: targetCategory.id,
      updatedAt: now,
    })
    .where(eq(products.id, product.id));

  // 6. Audit log
  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "update_product_category" : null,
    operation: "UPDATE_PRODUCT_CATEGORY",
    targetRecord: product.sku,
    beforeState: {
      categoryId: product.categoryId,
      categoryName: prevCat ? prevCat.name : "Uncategorized",
    },
    afterState: {
      categoryId: targetCategory.id,
      categoryName: targetCategory.name,
    },
    outcome: "SUCCESS",
  });

  return {
    success: true,
    productId: product.id,
    sku: product.sku,
    name: product.name,
    previousCategory: prevCat
      ? { id: prevCat.id, name: prevCat.name }
      : null,
    newCategory: { id: targetCategory.id, name: targetCategory.name },
    message: `Product "${product.name}" (${product.sku}) successfully assigned to category "${targetCategory.name}".`,
  };
}

export async function bulkUpdateProductCategories(params: {
  workspaceId: string;
  items: Array<{ productIdOrSku: string; categoryId: string }>;
  dryRun?: boolean;
  actor: StockActor;
}) {
  const db = await getDb();
  const isDryRun = params.dryRun !== false; // default true
  const items = params.items || [];

  if (items.length === 0) {
    throw new Error("No items provided for bulk category update.");
  }

  // Pre-load all workspace categories for fast validation
  const allCats = await (db as any)
    .select()
    .from(categories)
    .where(eq(categories.workspaceId, params.workspaceId));
  const catMap = new Map<string, any>(allCats.map((c: any) => [c.id, c]));

  const results: Array<{
    productIdOrSku: string;
    productId?: string;
    sku?: string;
    productName?: string;
    categoryId: string;
    status: "VALID" | "UPDATED" | "INVALID" | "UNCHANGED";
    previousCategory?: { id: string; name: string } | null;
    newCategory?: { id: string; name: string };
    error?: string;
  }> = [];

  let validCount = 0;
  let invalidCount = 0;
  let unchangedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const query = (item.productIdOrSku || "").trim();
    const targetCatId = (item.categoryId || "").trim();

    // 1. Resolve product
    const [prod] = await (db as any)
      .select()
      .from(products)
      .where(
        and(
          eq(products.workspaceId, params.workspaceId),
          or(eq(products.id, query), eq(products.sku, query.toUpperCase()))
        )
      )
      .limit(1);

    if (!prod) {
      invalidCount++;
      results.push({
        productIdOrSku: item.productIdOrSku,
        categoryId: item.categoryId,
        status: "INVALID",
        error: `Product not found: "${item.productIdOrSku}"`,
      });
      continue;
    }

    // 2. Resolve category
    const targetCat = catMap.get(targetCatId);
    if (!targetCat) {
      invalidCount++;
      results.push({
        productIdOrSku: item.productIdOrSku,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        categoryId: item.categoryId,
        status: "INVALID",
        error: `Category not found in workspace: "${item.categoryId}"`,
      });
      continue;
    }

    if (!targetCat.isActive) {
      invalidCount++;
      results.push({
        productIdOrSku: item.productIdOrSku,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        categoryId: item.categoryId,
        status: "INVALID",
        error: `Category "${targetCat.name}" is inactive.`,
      });
      continue;
    }

    const prevCat = prod.categoryId ? catMap.get(prod.categoryId) || null : null;
    if (prod.categoryId === targetCat.id) {
      unchangedCount++;
      results.push({
        productIdOrSku: item.productIdOrSku,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        categoryId: targetCat.id,
        status: "UNCHANGED",
        previousCategory: prevCat ? { id: prevCat.id, name: prevCat.name } : null,
        newCategory: { id: targetCat.id, name: targetCat.name },
      });
      continue;
    }

    validCount++;
    results.push({
      productIdOrSku: item.productIdOrSku,
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      categoryId: targetCat.id,
      status: isDryRun ? "VALID" : "UPDATED",
      previousCategory: prevCat ? { id: prevCat.id, name: prevCat.name } : null,
      newCategory: { id: targetCat.id, name: targetCat.name },
    });
  }

  // If live run, execute updates in a single transaction
  if (!isDryRun) {
    const toUpdate = results.filter((r) => r.status === "UPDATED");
    if (toUpdate.length > 0) {
      await (db as any).transaction(async (tx: any) => {
        for (const item of toUpdate) {
          await tx
            .update(products)
            .set({ categoryId: item.categoryId, updatedAt: new Date() })
            .where(eq(products.id, item.productId!));
        }
      });
      updatedCount = toUpdate.length;

      await logAuditEvent({
        workspaceId: params.workspaceId,
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
        toolName: params.actor.type === "AI_AGENT" ? "bulk_update_product_categories" : null,
        operation: "BULK_UPDATE_PRODUCT_CATEGORIES",
        targetRecord: `${updatedCount} products`,
        afterState: { updatedCount, items: toUpdate.map((u) => ({ sku: u.sku, newCat: u.categoryId })) },
        outcome: "SUCCESS",
      });
    }
  }

  return {
    isDryRun,
    summary: {
      total: items.length,
      valid: validCount,
      invalid: invalidCount,
      unchanged: unchangedCount,
      updated: updatedCount,
    },
    items: results,
    message: isDryRun
      ? `Dry run complete: ${validCount} valid assignments proposed, ${invalidCount} invalid, ${unchangedCount} already up to date. No database changes were made.`
      : `Bulk update complete: ${updatedCount} products updated successfully, ${invalidCount} failed, ${unchangedCount} unchanged.`,
  };
}

export async function suggestProductCategory(params: {
  workspaceId: string;
  productIdOrSku?: string;
  name?: string;
  description?: string;
}) {
  const db = await getDb();
  let productName = (params.name || "").trim();
  let productDesc = (params.description || "").trim();
  let resolvedProd: any = null;

  if (params.productIdOrSku) {
    const query = params.productIdOrSku.trim();
    const [prod] = await (db as any)
      .select()
      .from(products)
      .where(
        and(
          eq(products.workspaceId, params.workspaceId),
          or(eq(products.id, query), eq(products.sku, query.toUpperCase()))
        )
      )
      .limit(1);

    if (prod) {
      resolvedProd = prod;
      productName = prod.name;
      productDesc = prod.description || "";
    } else if (!productName) {
      throw new Error(`Product not found: "${params.productIdOrSku}"`);
    }
  }

  if (!productName && !productDesc) {
    throw new Error("Must provide either productIdOrSku, or name/description to suggest a category.");
  }

  const activeCats = await (db as any)
    .select()
    .from(categories)
    .where(and(eq(categories.workspaceId, params.workspaceId), eq(categories.isActive, true)));

  if (activeCats.length === 0) {
    return {
      productId: resolvedProd?.id,
      sku: resolvedProd?.sku,
      productName,
      suggestedCategory: null,
      confidence: 0,
      explanation: "No active categories found in this workspace.",
      recommendNewCategory: true,
      suggestedNewCategoryName: inferCategoryName(productName),
    };
  }

  // Semantic keyword taxonomy for personal care / retail products
  const domainKeywords: Record<string, string[]> = {
    "skin care": ["eye", "mask", "face", "cream", "skin", "serum", "lotion", "cleanser", "moisturizer", "toner", "sunscreen", "under-eye", "wrinkle", "anti-aging", "glow"],
    "lip care": ["lip", "balm", "gloss", "butter", "tint", "lipstick", "scrub", "chapped"],
    "hair care": ["hair", "scalp", "shampoo", "conditioner", "growth", "oil", "follicle", "dandruff", "strands", "root"],
    "body care": ["body", "soap", "wash", "shower", "bath", "lotion", "scrub", "butter", "moisturizing"],
    "fragrance": ["perfume", "cologne", "mist", "attar", "fragrance", "scent", "eau de"],
  };

  const fullProductText = `${productName} ${productDesc}`.toLowerCase();
  const productWords = fullProductText.split(/[\s,._\-/]+/).filter((w) => w.length > 2);

  let bestCat: any = null;
  let bestScore = 0;
  let matchReasons: string[] = [];

  for (const cat of activeCats) {
    let score = 0;
    const matchedTokens: string[] = [];
    const catNameLower = cat.name.toLowerCase();
    const catDescLower = (cat.description || "").toLowerCase();

    // 1. Direct category name match
    if (fullProductText.includes(catNameLower)) {
      score += 0.5;
      matchedTokens.push(`category name "${cat.name}"`);
    }

    // 2. Domain keyword matching
    for (const [domainKey, keywords] of Object.entries(domainKeywords)) {
      if (catNameLower.includes(domainKey) || domainKey.includes(catNameLower)) {
        for (const kw of keywords) {
          if (fullProductText.includes(kw)) {
            score += 0.15;
            matchedTokens.push(kw);
          }
        }
      }
    }

    // 3. Category description token overlap
    if (catDescLower) {
      for (const word of productWords) {
        if (catDescLower.includes(word) && !matchedTokens.includes(word)) {
          score += 0.1;
          matchedTokens.push(word);
        }
      }
    }

    const finalScore = Math.min(1.0, Math.round(score * 100) / 100);
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestCat = cat;
      matchReasons = Array.from(new Set(matchedTokens));
    }
  }

  if (bestScore >= 0.25 && bestCat) {
    return {
      productId: resolvedProd?.id,
      sku: resolvedProd?.sku,
      productName,
      suggestedCategory: {
        id: bestCat.id,
        name: bestCat.name,
        description: bestCat.description,
      },
      confidence: bestScore,
      explanation: `Product matches "${bestCat.name}" (confidence: ${Math.round(bestScore * 100)}%) based on matching terms: ${matchReasons.slice(0, 5).join(", ")}.`,
      recommendNewCategory: false,
    };
  } else {
    const inferred = inferCategoryName(productName);
    return {
      productId: resolvedProd?.id,
      sku: resolvedProd?.sku,
      productName,
      suggestedCategory: null,
      confidence: bestScore,
      explanation: `No existing category matches this product with high confidence (highest match score: ${bestScore}). Recommended creating a dedicated category instead of an incorrect assignment.`,
      recommendNewCategory: true,
      suggestedNewCategoryName: inferred,
    };
  }
}

function inferCategoryName(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes("oil")) return "Oils & Serums";
  if (lower.includes("soap") || lower.includes("wash")) return "Bath & Body";
  if (lower.includes("hair")) return "Hair Care";
  if (lower.includes("lip")) return "Lip Care";
  if (lower.includes("eye") || lower.includes("face") || lower.includes("mask") || lower.includes("cream")) return "Skin Care";
  return "Specialty Care";
}

export async function createCategoryIfMissing(params: {
  workspaceId: string;
  name: string;
  description?: string | null;
  actor: StockActor;
}) {
  const db = await getDb();
  const normalized = params.name.trim().toLowerCase();

  const existingCats = await (db as any)
    .select()
    .from(categories)
    .where(eq(categories.workspaceId, params.workspaceId));

  const match = existingCats.find(
    (c: any) => c.name.trim().toLowerCase() === normalized
  );

  if (match) {
    return {
      created: false,
      category: match,
      message: `Category "${match.name}" already exists (ID: ${match.id}).`,
    };
  }

  const newCat = await createCategory({
    workspaceId: params.workspaceId,
    name: params.name.trim(),
    description: params.description || null,
  });

  return {
    created: true,
    category: {
      id: newCat.id,
      workspaceId: params.workspaceId,
      name: newCat.name,
      description: params.description || null,
      isActive: true,
    },
    message: `Created new category "${newCat.name}" (ID: ${newCat.id}).`,
  };
}

export async function getProductCategory(params: {
  workspaceId: string;
  productIdOrSku: string;
}) {
  const db = await getDb();
  const query = params.productIdOrSku.trim();

  const [prod] = await (db as any)
    .select()
    .from(products)
    .where(
      and(
        eq(products.workspaceId, params.workspaceId),
        or(eq(products.id, query), eq(products.sku, query.toUpperCase()))
      )
    )
    .limit(1);

  if (!prod) {
    throw new Error(`Product not found: "${params.productIdOrSku}"`);
  }

  if (!prod.categoryId) {
    return {
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      isCategorized: false,
      category: null,
      isCategoryInactive: false,
      status: "UNCATEGORIZED",
      message: `Product "${prod.name}" (${prod.sku}) is currently uncategorized.`,
    };
  }

  const [cat] = await (db as any)
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, prod.categoryId),
        eq(categories.workspaceId, params.workspaceId)
      )
    )
    .limit(1);

  if (!cat) {
    return {
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      isCategorized: false,
      category: null,
      isCategoryInactive: false,
      status: "ORPHANED_CATEGORY_REFERENCE",
      message: `Product references category ID "${prod.categoryId}", but the category record does not exist.`,
    };
  }

  return {
    productId: prod.id,
    sku: prod.sku,
    name: prod.name,
    isCategorized: true,
    category: {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      isActive: cat.isActive,
      createdAt: cat.createdAt,
    },
    isCategoryInactive: !cat.isActive,
    status: cat.isActive ? "ACTIVE" : "INACTIVE_CATEGORY",
    message: `Product "${prod.name}" (${prod.sku}) belongs to category "${cat.name}".`,
  };
}

export async function deleteProduct(params: {
  workspaceId: string;
  productIdOrSku: string;
  actor: StockActor;
  force?: boolean;
}) {
  const db = await getDb();
  const [product] = await (db as any)
    .select()
    .from(products)
    .where(
      and(
        eq(products.workspaceId, params.workspaceId),
        or(
          eq(products.id, params.productIdOrSku),
          eq(products.sku, params.productIdOrSku.toUpperCase())
        )
      )
    )
    .limit(1);

  if (!product) {
    throw new Error(`Product not found: "${params.productIdOrSku}"`);
  }

  // Check if unfulfilled active orders contain this product
  const activeOrderRows = await (db as any)
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.productId, product.id),
        sql`${orders.status} IN ('NEW', 'CONFIRMED', 'PROCESSING', 'PACKED')`
      )
    );

  if (activeOrderRows.length > 0 && !params.force) {
    const orderNumbers = activeOrderRows.map((r: any) => r.orderNumber).join(", ");
    throw new Error(
      `Cannot delete product "${product.name}" (SKU: ${product.sku}) because it is reserved in active unfulfilled order(s): ${orderNumbers}. Please cancel or fulfill those orders first.`
    );
  }

  // Clean up order items and transactions for this product
  await (db as any)
    .delete(orderItems)
    .where(eq(orderItems.productId, product.id));

  await (db as any)
    .delete(inventoryTransactions)
    .where(eq(inventoryTransactions.productId, product.id));

  // Delete product
  await (db as any)
    .delete(products)
    .where(eq(products.id, product.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "delete_product" : null,
    operation: "DELETE_PRODUCT",
    targetRecord: product.sku,
    beforeState: product,
    afterState: null,
    outcome: "SUCCESS",
  });

  return {
    success: true,
    deletedId: product.id,
    sku: product.sku,
    name: product.name,
  };
}

export async function deleteCategory(params: {
  workspaceId: string;
  categoryId: string;
  actor: StockActor;
  productPolicy?: "UNASSIGN" | "REASSIGN" | "REJECT";
  reassignCategoryId?: string;
}) {
  const db = await getDb();
  const catId = params.categoryId.trim();
  const [category] = await (db as any)
    .select()
    .from(categories)
    .where(and(eq(categories.workspaceId, params.workspaceId), eq(categories.id, catId)))
    .limit(1);

  if (!category) {
    throw new Error(`Category not found: "${params.categoryId}"`);
  }

  const policy = params.productPolicy || "UNASSIGN";

  // Check products assigned to this category
  const assignedProducts = await (db as any)
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(and(eq(products.workspaceId, params.workspaceId), eq(products.categoryId, category.id)));

  if (policy === "REJECT" && assignedProducts.length > 0) {
    const skuList = assignedProducts.slice(0, 5).map((p: any) => p.sku).join(", ");
    throw new Error(
      `Cannot delete category "${category.name}" because ${assignedProducts.length} product(s) are assigned to it (${skuList}). Reassign products first or specify productPolicy: "UNASSIGN".`
    );
  }

  if (policy === "REASSIGN") {
    if (!params.reassignCategoryId) {
      throw new Error("Must provide reassignCategoryId when productPolicy is 'REASSIGN'.");
    }
    const targetCatId = params.reassignCategoryId.trim();
    const [targetReassign] = await (db as any)
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.workspaceId, params.workspaceId),
          eq(categories.id, targetCatId)
        )
      )
      .limit(1);

    if (!targetReassign) {
      throw new Error(`Target reassign category not found: "${params.reassignCategoryId}" in this workspace.`);
    }

    if (!targetReassign.isActive) {
      throw new Error(`Target reassign category "${targetReassign.name}" is inactive.`);
    }

    if (assignedProducts.length > 0) {
      await (db as any)
        .update(products)
        .set({ categoryId: targetReassign.id, updatedAt: new Date() })
        .where(eq(products.categoryId, category.id));
    }
  } else {
    // UNASSIGN (default): Safely unlink products, setting categoryId to null
    if (assignedProducts.length > 0) {
      await (db as any)
        .update(products)
        .set({ categoryId: null, updatedAt: new Date() })
        .where(eq(products.categoryId, category.id));
    }
  }

  // Delete category record
  await (db as any)
    .delete(categories)
    .where(eq(categories.id, category.id));

  await logAuditEvent({
    workspaceId: params.workspaceId,
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorType: params.actor.type === "AI_AGENT" ? "AI_CLIENT" : "USER",
    toolName: params.actor.type === "AI_AGENT" ? "delete_category" : null,
    operation: "DELETE_CATEGORY",
    targetRecord: category.id,
    beforeState: category,
    afterState: null,
    outcome: "SUCCESS",
  });

  return {
    success: true,
    deletedId: category.id,
    name: category.name,
    productsAffected: assignedProducts.length,
    productPolicy: policy,
    reassignedTo: policy === "REASSIGN" ? params.reassignCategoryId : null,
    warning: assignedProducts.length > 0 && policy === "UNASSIGN"
      ? `${assignedProducts.length} product(s) previously in this category are now uncategorized.`
      : null,
  };
}
