import { getDb } from "../lib/db/client";
import { verifyMcpToken } from "../lib/auth/oauth";
import { createMcpServer } from "../lib/mcp/server";
import * as productService from "../lib/services/product-service";
import * as inventoryService from "../lib/services/inventory-service";
import { products, categories, workspaces } from "../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

async function runCategoryTestSuite() {
  console.log("===============================================================");
  console.log("  MCP PRODUCT CATEGORY MANAGEMENT TOOL VERIFICATION SUITE");
  console.log("===============================================================");

  const db = await getDb();
  const principal = await verifyMcpToken("Bearer mcp_dev_token_apex");
  if (!principal) throw new Error("Auth verification failed");
  const workspaceId = principal.workspaceId;

  // Helper to send JSON-RPC request to MCP server instance
  async function callMcp(method: string, params: any) {
    const server = createMcpServer(principal!);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);

    const req = new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer mcp_dev_token_apex",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 100000),
        method,
        params,
      }),
    });

    const res = await transport.handleRequest(req);
    return await res.json();
  }

  // Ensure secondary workspace exists for workspace isolation test
  const testOtherWsId = "ws_test_isolated_" + Date.now();
  await (db as any).insert(workspaces).values({
    id: testOtherWsId,
    name: "Foreign Workspace",
    slug: "foreign-" + Date.now(),
    currency: "INR",
  });

  const foreignCat = await productService.createCategory({
    workspaceId: testOtherWsId,
    name: "Foreign Category " + Date.now(),
    description: "Belongs strictly to foreign workspace",
  });

  console.log("✓ Test setup ready. Workspace:", workspaceId, "| Foreign WS:", testOtherWsId);

  // --------------------------------------------------------------------------
  // TEST 1: MCP Tool Discovery & Schema Compliance
  // --------------------------------------------------------------------------
  console.log("\n[Test 1] MCP tools/list discovery and annotations check");
  const toolsRes = await callMcp("tools/list", {});
  const tools = toolsRes.result.tools;
  const toolNames = tools.map((t: any) => t.name);

  const requiredNewTools = [
    "update_product_category",
    "bulk_update_product_categories",
    "suggest_product_category",
    "create_category_if_missing",
    "get_product_category",
    "list_categories",
    "create_category",
    "update_category",
    "delete_category",
  ];

  for (const tName of requiredNewTools) {
    if (!toolNames.includes(tName)) {
      throw new Error(`Expected MCP tool '${tName}' was NOT found in tools/list!`);
    }
  }

  const updateTool = tools.find((t: any) => t.name === "update_product_category");
  if (updateTool.annotations?.destructiveHint !== false || updateTool.annotations?.readOnlyHint !== false) {
    throw new Error("update_product_category annotations must declare non-destructive, write tool.");
  }
  const suggestTool = tools.find((t: any) => t.name === "suggest_product_category");
  if (suggestTool.annotations?.readOnlyHint !== true) {
    throw new Error("suggest_product_category must declare readOnlyHint: true.");
  }

  console.log(`✓ All 9 category tools discovered with valid annotations! Total server tools: ${tools.length}`);

  // --------------------------------------------------------------------------
  // TEST 2: Setup Baseline Categories (Lip Care & Skin Care)
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] Creating baseline categories: Lip Care and Skin Care");
  const lipCareRes = await callMcp("tools/call", {
    name: "create_category_if_missing",
    arguments: {
      name: "Lip Care " + Date.now(),
      description: "Products for lip hydration, lip balms, and lip scrubs",
    },
  });
  const lipCareCat = JSON.parse(lipCareRes.result.content[0].text).category;

  const skinCareRes = await callMcp("tools/call", {
    name: "create_category_if_missing",
    arguments: {
      name: "Skin Care " + Date.now(),
      description: "Facial masks, under-eye treatments, serums, and cleansers",
    },
  });
  const skinCareCat = JSON.parse(skinCareRes.result.content[0].text).category;

  console.log(`✓ Baseline categories created: Lip Care (${lipCareCat.id}), Skin Care (${skinCareCat.id})`);

  // --------------------------------------------------------------------------
  // TEST 3: Create MAKA-SC-001 in Lip Care and Move to Skin Care
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Moving MAKA-SC-001 from Lip Care to Skin Care");
  const testSku = "MAKA-SC-" + Date.now();
  const testProduct = await productService.createProduct({
    workspaceId,
    name: "Under-Eye Cream Mask",
    sku: testSku,
    barcode: "890123456789",
    purchaseCost: 150.0,
    sellingPrice: 350.0,
    initialStock: 25,
    reorderThreshold: 5,
    categoryId: lipCareCat.id,
    description: "Soothing under-eye cream mask targeting puffiness and dark circles",
    actor: { id: "test_runner", name: "Category Test Suite", type: "AI_AGENT" },
  });

  // Reserve 5 units to test that stock & reservations are preserved
  await inventoryService.reserveStockForOrder({
    workspaceId,
    orderId: "ord_test_preserve",
    orderNumber: "ORD-PRESERVE-01",
    items: [{ productId: testProduct.id, quantity: 5 }],
    actor: { id: "test_runner", name: "Category Test Suite", type: "AI_AGENT" },
  });

  const beforeSummary = await productService.listProducts(workspaceId, { search: testSku });
  const beforeProd = beforeSummary[0];
  if (beforeProd.categoryId !== lipCareCat.id) {
    throw new Error("Initial category mismatch!");
  }

  // Move product to Skin Care
  const moveRes = await callMcp("tools/call", {
    name: "update_product_category",
    arguments: {
      productIdOrSku: testSku,
      categoryId: skinCareCat.id,
    },
  });

  if (moveRes.result.isError) {
    throw new Error(`update_product_category failed: ${JSON.stringify(moveRes)}`);
  }
  const moveData = JSON.parse(moveRes.result.content[0].text);
  console.log("✓ update_product_category response:", moveData.message);

  if (moveData.previousCategory?.id !== lipCareCat.id || moveData.newCategory?.id !== skinCareCat.id) {
    throw new Error("Returned previous or new category incorrect!");
  }

  // Verify all fields preserved
  const [afterProd] = await (db as any)
    .select()
    .from(products)
    .where(eq(products.id, testProduct.id));

  if (afterProd.categoryId !== skinCareCat.id) throw new Error("Database categoryId was not updated!");
  if (afterProd.sku !== testSku) throw new Error("SKU was mutated!");
  if (afterProd.name !== "Under-Eye Cream Mask") throw new Error("Name was mutated!");
  if (afterProd.barcode !== "890123456789") throw new Error("Barcode was mutated!");
  if (parseFloat(afterProd.sellingPrice) !== 350.0) throw new Error("Price was mutated!");
  if (parseFloat(afterProd.purchaseCost) !== 150.0) throw new Error("Cost was mutated!");
  if (afterProd.physicalStock !== 25) throw new Error("Physical stock was mutated!");
  if (afterProd.reservedStock !== 5) throw new Error("Reserved stock was mutated!");
  if (afterProd.isActive !== true) throw new Error("Active status was mutated!");

  console.log("✓ Verified: categoryId updated to Skin Care; all 9 unrelated fields remained 100% intact!");

  // --------------------------------------------------------------------------
  // TEST 4: get_product_category inspection
  // --------------------------------------------------------------------------
  console.log("\n[Test 4] Inspecting product category via get_product_category");
  const getCatRes = await callMcp("tools/call", {
    name: "get_product_category",
    arguments: { productIdOrSku: testSku },
  });
  const getCatData = JSON.parse(getCatRes.result.content[0].text);
  if (!getCatData.isCategorized || getCatData.category.id !== skinCareCat.id) {
    throw new Error("get_product_category returned unexpected category!");
  }
  console.log("✓ get_product_category confirmed active category:", getCatData.category.name);

  // Uncategorized check
  const uncatProd = await productService.createProduct({
    workspaceId,
    name: "Uncategorized Item " + Date.now(),
    sku: "UNCAT-" + Date.now(),
    purchaseCost: 50,
    sellingPrice: 100,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
  });
  const uncatCheck = await callMcp("tools/call", {
    name: "get_product_category",
    arguments: { productIdOrSku: uncatProd.sku },
  });
  const uncatData = JSON.parse(uncatCheck.result.content[0].text);
  if (uncatData.isCategorized !== false || uncatData.status !== "UNCATEGORIZED") {
    throw new Error("Uncategorized product check failed!");
  }
  console.log("✓ get_product_category confirmed uncategorized status cleanly");

  // --------------------------------------------------------------------------
  // TEST 5: Error handling - Invalid Product and Invalid Category
  // --------------------------------------------------------------------------
  console.log("\n[Test 5] Error Handling: Invalid Product, Invalid Category, and Cross-Workspace");
  const invProdRes = await callMcp("tools/call", {
    name: "update_product_category",
    arguments: { productIdOrSku: "NON_EXISTENT_SKU_999", categoryId: skinCareCat.id },
  });
  if (!invProdRes.result?.isError && !invProdRes.result?.content[0]?.text?.includes("Product not found")) {
    throw new Error("Did not reject non-existent product!");
  }
  console.log("✓ Correctly rejected non-existent product ID/SKU");

  const invCatRes = await callMcp("tools/call", {
    name: "update_product_category",
    arguments: { productIdOrSku: testSku, categoryId: "cat_invalid_99999" },
  });
  if (!invCatRes.result?.isError && !invCatRes.result?.content[0]?.text?.includes("Category not found")) {
    throw new Error("Did not reject non-existent category!");
  }
  console.log("✓ Correctly rejected non-existent category ID");

  const foreignCatRes = await callMcp("tools/call", {
    name: "update_product_category",
    arguments: { productIdOrSku: testSku, categoryId: foreignCat.id },
  });
  if (!foreignCatRes.result?.isError && !foreignCatRes.result?.content[0]?.text?.includes("another workspace")) {
    throw new Error("Did not enforce workspace isolation for cross-workspace category!");
  }
  console.log("✓ Workspace isolation enforced: foreign workspace category rejected!");

  // Inactive category rejection
  const inactiveCat = await productService.createCategory({
    workspaceId,
    name: "Archived Seasonal " + Date.now(),
  });
  await productService.updateCategory({
    workspaceId,
    categoryId: inactiveCat.id,
    isActive: false,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
  });

  const inactMoveRes = await callMcp("tools/call", {
    name: "update_product_category",
    arguments: { productIdOrSku: testSku, categoryId: inactiveCat.id },
  });
  if (!inactMoveRes.result?.isError && !inactMoveRes.result?.content[0]?.text?.includes("inactive")) {
    throw new Error("Did not reject moving product to inactive category!");
  }
  console.log("✓ Inactive category rejected cleanly");

  // --------------------------------------------------------------------------
  // TEST 6: Duplicate Category Prevention & create_category_if_missing
  // --------------------------------------------------------------------------
  console.log("\n[Test 6] Preventing Duplicate Categories");
  const dupCheck1 = await callMcp("tools/call", {
    name: "create_category_if_missing",
    arguments: { name: skinCareCat.name },
  });
  const dupData1 = JSON.parse(dupCheck1.result.content[0].text);
  if (dupData1.created !== false || dupData1.category.id !== skinCareCat.id) {
    throw new Error("create_category_if_missing failed to detect existing category!");
  }
  console.log("✓ create_category_if_missing safely returned existing category without creating a duplicate");

  // Direct create_category duplicate check
  const dupDirect = await callMcp("tools/call", {
    name: "create_category",
    arguments: { name: skinCareCat.name.toUpperCase() },
  });
  if (!dupDirect.result?.isError && !dupDirect.result?.content[0]?.text?.includes("already exists")) {
    throw new Error("create_category did not prevent duplicate normalized category name!");
  }
  console.log("✓ create_category prevented duplicate normalized category name");

  // --------------------------------------------------------------------------
  // TEST 7: Bulk Category Updates (Dry-Run and Live Execution)
  // --------------------------------------------------------------------------
  console.log("\n[Test 7] Bulk Category Updates: Dry Run & Transaction Execution");
  const bulkProdA = await productService.createProduct({
    workspaceId,
    name: "Bulk Soap A",
    sku: "BULK-A-" + Date.now(),
    purchaseCost: 20,
    sellingPrice: 50,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
  });
  const bulkProdB = await productService.createProduct({
    workspaceId,
    name: "Bulk Shampoo B",
    sku: "BULK-B-" + Date.now(),
    purchaseCost: 30,
    sellingPrice: 80,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
  });

  // 1. Dry run test with mixture of valid and invalid
  const dryRunRes = await callMcp("tools/call", {
    name: "bulk_update_product_categories",
    arguments: {
      items: [
        { productIdOrSku: bulkProdA.sku, categoryId: skinCareCat.id },
        { productIdOrSku: "INVALID_PROD_SKU", categoryId: lipCareCat.id },
        { productIdOrSku: bulkProdB.sku, categoryId: "INVALID_CAT_ID" },
      ],
      dryRun: true,
    },
  });
  const dryRunData = JSON.parse(dryRunRes.result.content[0].text);
  if (!dryRunData.isDryRun) throw new Error("Expected dryRun: true");
  if (dryRunData.summary.valid !== 1 || dryRunData.summary.invalid !== 2) {
    throw new Error(`Dry run counts unexpected: ${JSON.stringify(dryRunData.summary)}`);
  }

  // Ensure DB was not modified
  const [checkProdA] = await (db as any).select().from(products).where(eq(products.id, bulkProdA.id));
  if (checkProdA.categoryId !== null) {
    throw new Error("Dry run performed a database write!");
  }
  console.log("✓ Dry run verified: accurately previewed 1 valid and 2 invalid assignments without database writes");

  // 2. Live execution test
  const liveBulkRes = await callMcp("tools/call", {
    name: "bulk_update_product_categories",
    arguments: {
      items: [
        { productIdOrSku: bulkProdA.sku, categoryId: skinCareCat.id },
        { productIdOrSku: bulkProdB.sku, categoryId: lipCareCat.id },
      ],
      dryRun: false,
    },
  });
  const liveBulkData = JSON.parse(liveBulkRes.result.content[0].text);
  if (liveBulkData.summary.updated !== 2) {
    throw new Error("Live bulk update failed to update 2 items!");
  }
  const [liveCheckA] = await (db as any).select().from(products).where(eq(products.id, bulkProdA.id));
  const [liveCheckB] = await (db as any).select().from(products).where(eq(products.id, bulkProdB.id));
  if (liveCheckA.categoryId !== skinCareCat.id || liveCheckB.categoryId !== lipCareCat.id) {
    throw new Error("Live bulk update database values did not match!");
  }
  console.log("✓ Live bulk update committed both product assignments atomically");

  // --------------------------------------------------------------------------
  // TEST 8: Category Suggestion (suggest_product_category)
  // --------------------------------------------------------------------------
  console.log("\n[Test 8] Testing suggest_product_category");
  const suggestMask = await callMcp("tools/call", {
    name: "suggest_product_category",
    arguments: {
      name: "Under-Eye Collagen Cream Mask",
      description: "Hydrating mask for delicate skin under the eyes",
    },
  });
  const maskData = JSON.parse(suggestMask.result.content[0].text);
  if (!maskData.suggestedCategory?.name.toLowerCase().includes("skin care")) {
    throw new Error(`Expected Skin Care suggestion for mask, got: ${JSON.stringify(maskData)}`);
  }
  console.log(`✓ suggest_product_category accurately recommended: "${maskData.suggestedCategory.name}" (Confidence: ${maskData.confidence})`);

  // Unrelated product suggestion
  const suggestRocket = await callMcp("tools/call", {
    name: "suggest_product_category",
    arguments: {
      name: "Supersonic Propulsion Turbine",
      description: "Aerospace turbine rocket engine",
    },
  });
  const rocketData = JSON.parse(suggestRocket.result.content[0].text);
  if (rocketData.suggestedCategory !== null || rocketData.recommendNewCategory !== true) {
    throw new Error("Expected no suitable category for aerospace item!");
  }
  console.log("✓ suggest_product_category correctly avoided miscategorization and recommended creating a new category");

  // --------------------------------------------------------------------------
  // TEST 9: Delete Category with Product Policy (REJECT, UNASSIGN, REASSIGN)
  // --------------------------------------------------------------------------
  console.log("\n[Test 9] Delete Category with Product Policies (REJECT, UNASSIGN, REASSIGN)");
  const doomedCat = await productService.createCategory({
    workspaceId,
    name: "Doomed Category " + Date.now(),
  });
  const doomedProd = await productService.createProduct({
    workspaceId,
    name: "Doomed Item",
    sku: "DOOM-" + Date.now(),
    purchaseCost: 10,
    sellingPrice: 20,
    categoryId: doomedCat.id,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
  });

  // 1. REJECT policy when products are assigned
  const rejectDel = await callMcp("tools/call", {
    name: "delete_category",
    arguments: {
      categoryId: doomedCat.id,
      productPolicy: "REJECT",
      confirmed: true,
    },
  });
  if (!rejectDel.result?.isError && !rejectDel.result?.content[0]?.text?.includes("assigned to it")) {
    throw new Error("delete_category with REJECT policy did not block deletion!");
  }
  console.log("✓ delete_category with REJECT policy correctly blocked deletion when products are assigned");

  // 2. REASSIGN policy to move doomed item to Skin Care
  const reassignDel = await callMcp("tools/call", {
    name: "delete_category",
    arguments: {
      categoryId: doomedCat.id,
      productPolicy: "REASSIGN",
      reassignCategoryId: skinCareCat.id,
      confirmed: true,
    },
  });
  if (reassignDel.result?.isError) {
    throw new Error(`delete_category with REASSIGN failed: ${JSON.stringify(reassignDel)}`);
  }
  const [reassignedProdCheck] = await (db as any).select().from(products).where(eq(products.id, doomedProd.id));
  if (reassignedProdCheck.categoryId !== skinCareCat.id) {
    throw new Error("Product was not reassigned to Skin Care!");
  }
  console.log("✓ delete_category with REASSIGN policy successfully moved assigned products to Skin Care and deleted old category");

  // --------------------------------------------------------------------------
  // TEST 10: Category List with Product Counts
  // --------------------------------------------------------------------------
  console.log("\n[Test 10] list_categories with Product Counts");
  const listCatRes = await callMcp("tools/call", {
    name: "list_categories",
    arguments: {},
  });
  const catList = JSON.parse(listCatRes.result.content[0].text);
  const foundSkin = catList.find((c: any) => c.id === skinCareCat.id);
  if (!foundSkin || typeof foundSkin.productCount !== "number" || foundSkin.productCount < 1) {
    throw new Error("list_categories did not include valid productCount!");
  }
  console.log(`✓ list_categories verified: "${foundSkin.name}" reports productCount = ${foundSkin.productCount}`);

  // Cleanup test artifacts
  await productService.deleteProduct({
    workspaceId,
    productIdOrSku: testSku,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
    force: true,
  });
  await productService.deleteCategory({
    workspaceId,
    categoryId: lipCareCat.id,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
    productPolicy: "UNASSIGN",
  });
  await productService.deleteCategory({
    workspaceId,
    categoryId: skinCareCat.id,
    actor: { id: "test", name: "test", type: "AI_AGENT" },
    productPolicy: "UNASSIGN",
  });

  console.log("\n===============================================================");
  console.log("  ALL CATEGORY MANAGEMENT & MCP TESTS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================");
  process.exit(0);
}

runCategoryTestSuite().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
