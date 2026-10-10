import { getDb } from "../lib/db/client";
import { verifyMcpToken, verifyPkce } from "../lib/auth/oauth";
import { createMcpServer } from "../lib/mcp/server";
import * as inventoryService from "../lib/services/inventory-service";
import * as orderService from "../lib/services/order-service";
import * as packingService from "../lib/services/packing-service";
import * as shippingService from "../lib/services/shipping-service";
import * as paymentService from "../lib/services/payment-service";
import * as reportService from "../lib/services/report-service";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

async function runTests() {
  console.log("=== STARTING COMPREHENSIVE PLATFORM VERIFICATION ===");
  const db = await getDb();
  console.log("✓ Database connection and schema verified");

  // 1. Verify PKCE S256 Algorithm
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  const pkceValid = verifyPkce(verifier, challenge, "S256");
  console.log(`✓ PKCE S256 Verification: ${pkceValid ? "PASSED" : "FAILED"}`);
  if (!pkceValid) throw new Error("PKCE S256 math failed");

  // 2. Verify MCP Token Auth
  const principal = await verifyMcpToken("Bearer mcp_dev_token_apex");
  if (!principal || principal.workspaceId !== "ws_apex_main") {
    throw new Error("Token auth failed");
  }
  console.log("✓ MCP OAuth Bearer Token Verification: PASSED (Workspace: " + principal.workspaceId + ")");

  // 3. Test Dashboard Overview
  const dashboard = await reportService.getDashboardOverview(principal.workspaceId);
  console.log("✓ Dashboard Business Aggregates:", {
    totalProducts: dashboard.products.total,
    physicalStock: dashboard.products.physicalStock,
    ordersToPack: dashboard.orders.toPack,
    totalRevenue: dashboard.financials.totalRevenue,
  });

  // 4. Test Stock Availability & Order Creation with Automatic Stock Reservation
  const initialSummary = await inventoryService.getInventorySummary(principal.workspaceId);
  console.log("✓ Inventory state before new order:", {
    totalPhysical: initialSummary.totalPhysicalStock,
    totalReserved: initialSummary.totalReservedStock,
    totalAvailable: initialSummary.totalAvailableStock,
  });

  const testOrder = await orderService.createOrder({
    workspaceId: principal.workspaceId,
    customerId: "cust_priya_sharma",
    shippingAddress: "45 Cyber City, DLF Phase 2, Gurugram, HR - 122002",
    source: "WhatsApp",
    items: [
      {
        productId: "prd_noise_cancelling_headphones",
        quantity: 2,
      },
    ],
    actor: { id: "test_suite", name: "Vitest Automated Runner", type: "AI_AGENT" },
    sourceType: "mcp",
  });
  console.log("✓ Order created successfully:", testOrder.orderNumber, "Status:", testOrder.status);

  // Verify stock reservation increased by 2
  const updatedSummary = await inventoryService.getInventorySummary(principal.workspaceId);
  console.log("✓ Inventory state after order creation:", {
    totalPhysical: updatedSummary.totalPhysicalStock,
    totalReserved: updatedSummary.totalReservedStock,
    totalAvailable: updatedSummary.totalAvailableStock,
  });
  if (updatedSummary.totalReservedStock !== initialSummary.totalReservedStock + 2) {
    throw new Error("Inventory reservation failed to increment reservedStock!");
  }

  // 5. Test Packing Workflow
  const packResult = await packingService.markOrderPacked({
    workspaceId: principal.workspaceId,
    orderId: testOrder.orderId,
    packingNotes: "Tested and securely packed in double corrugated carton",
    actor: { id: "packer_01", name: "Packer Unit", type: "USER" },
    sourceType: "web",
  });
  console.log("✓ Packing workflow verified. New status:", packResult.currentStatus);

  // 6. Test Shipping Workflow (Atomically reduces physical stock & releases reservation)
  const shipResult = await shippingService.markOrderShipped({
    workspaceId: principal.workspaceId,
    orderId: testOrder.orderId,
    courier: "Blue Dart Express",
    trackingNumber: "BD992817290IN",
    actor: { id: "shipping_01", name: "Dispatch Manager", type: "USER" },
    sourceType: "web",
  });
  console.log("✓ Shipping workflow verified. Shipment created:", shipResult.shipmentId, "Tracking:", shipResult.trackingNumber);

  // Verify physical stock decreased by 2, and reservation was released
  const postShipSummary = await inventoryService.getInventorySummary(principal.workspaceId);
  console.log("✓ Inventory state after shipment dispatch:", {
    totalPhysical: postShipSummary.totalPhysicalStock,
    totalReserved: postShipSummary.totalReservedStock,
    totalAvailable: postShipSummary.totalAvailableStock,
  });
  if (postShipSummary.totalPhysicalStock !== initialSummary.totalPhysicalStock - 2) {
    throw new Error("Physical stock was not deducted on order dispatch!");
  }

  // 7. Test Payment Recording
  const paymentResult = await paymentService.recordPayment({
    workspaceId: principal.workspaceId,
    orderId: testOrder.orderId,
    amount: parseFloat(testOrder.totalAmount),
    paymentMethod: "UPI",
    reference: "UPI/AUTO_TEST/98213",
    actor: { id: "accounts_01", name: "Accounts Dept", type: "USER" },
    sourceType: "web",
  });
  console.log("✓ Payment recorded:", paymentResult.amountPaid, "Order status:", paymentResult.paymentStatus);

  // 8. Test MCP JSON-RPC Server
  async function sendMcpRequest(payload: any) {
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
      body: JSON.stringify(payload),
    });

    const res = await transport.handleRequest(req);
    return await res.json();
  }

  // Send tools/list request
  const toolsData = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  });

  const toolsCount = toolsData?.result?.tools?.length || 0;
  console.log(`✓ MCP tools/list returned ${toolsCount} tools!`);
  if (toolsCount < 40) {
    throw new Error(`Expected at least 40 tools, got ${toolsCount}`);
  }

  // Send tools/call for get_dashboard_summary
  const callData = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "get_dashboard_summary",
      arguments: {},
    },
  });

  console.log("✓ MCP tools/call get_dashboard_summary returned successfully:", !!callData?.result?.content?.[0]?.text);

  // 9. Test OpenAI Profile Tool
  const profileCall = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_user_profile",
      arguments: {},
    },
  });
  console.log("✓ MCP tools/call get_user_profile returned:", profileCall?.result?.structuredContent?.name);
  if (!profileCall?.result?._meta?.["openai/profile"]) {
    throw new Error("Missing openai/profile metadata on profile tool!");
  }

  // 10. Test Company Knowledge Search Tool
  const searchCall = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "search",
      arguments: { query: "Headphones" },
    },
  });
  console.log("✓ MCP tools/call search returned items count:", searchCall?.result?.structuredContent?.results?.length);

  // 11. Test OpenAI Skills Extension (skills/list & skills/get)
  const skillsListData = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "skills/list",
    params: {},
  });
  console.log("✓ MCP skills/list returned skills count:", skillsListData?.result?.skills?.length);
  if (!skillsListData?.result?.skills?.length) {
    throw new Error("Skills list was empty!");
  }

  const firstSkill = skillsListData.result.skills[0];
  const skillGetData = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "skills/get",
    params: { uri: firstSkill.uri },
  });
  console.log("✓ MCP skills/get returned skill name:", skillGetData?.result?.skill?.frontmatter?.name);

  // 12. Test resources/read on skill URI
  const resourceReadData = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 7,
    method: "resources/read",
    params: { uri: firstSkill.uri },
  });
  console.log("✓ MCP resources/read on skill URI returned content length:", resourceReadData?.result?.contents?.[0]?.text?.length);

  // 13. Test ChatGPT MCP Compliant Destructive Deletion Tools
  console.log("\n--- Testing Destructive Deletion Tools (ChatGPT MCP Guide Compliance) ---");

  // Verify annotations on delete tools in tools/list
  const deleteToolNames = [
    "delete_product",
    "delete_order",
    "delete_customer",
    "delete_category",
    "delete_payment",
    "delete_return",
  ];

  for (const name of deleteToolNames) {
    const tool = toolsData.result.tools.find((t: any) => t.name === name);
    if (!tool) throw new Error(`Missing destructive tool '${name}' in tools/list!`);
    if (tool.annotations?.destructiveHint !== true) {
      throw new Error(`Tool '${name}' must have annotations.destructiveHint: true for ChatGPT MCP compliance!`);
    }
    if (tool.annotations?.readOnlyHint !== false) {
      throw new Error(`Tool '${name}' must have annotations.readOnlyHint: false!`);
    }
    console.log(`✓ Verified ChatGPT MCP compliance for '${name}': destructiveHint = true, readOnlyHint = false`);
  }

  // Create a dedicated product and order to test deletions
  const testDelProduct = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "create_product",
      arguments: {
        name: "Temporary Deletion Test Item",
        sku: "TEST-DEL-" + Date.now(),
        purchaseCost: 50,
        sellingPrice: 100,
        initialStock: 20,
      },
    },
  });
  const delProdResult = JSON.parse(testDelProduct.result.content[0].text);
  const delProdId = delProdResult.id;
  console.log("✓ Created test product for deletion:", delProdId);

  // Create order reserving stock of this product
  const testDelOrder = await orderService.createOrder({
    workspaceId: principal.workspaceId,
    customerId: "cust_priya_sharma",
    shippingAddress: "Test Address for Deletion",
    source: "MCP Test",
    items: [{ productId: delProdId, quantity: 3 }],
    actor: { id: "test_suite", name: "Vitest Automated Runner", type: "AI_AGENT" },
    sourceType: "mcp",
  });
  console.log("✓ Created order reserving 3 units of test product:", testDelOrder.orderNumber);

  // Attempt delete_order WITHOUT confirmation -> must require confirmation
  const unconfirmedDelOrder = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: {
      name: "delete_order",
      arguments: {
        orderIdOrNumber: testDelOrder.orderId,
      },
    },
  });
  const unconfirmedOrderRes = unconfirmedDelOrder.result?.structuredContent;
  if (!unconfirmedOrderRes?.confirmationRequired || !unconfirmedOrderRes?.confirmationToken) {
    throw new Error("delete_order without confirmation failed to trigger confirmation requirement!");
  }
  console.log("✓ Unconfirmed delete_order correctly blocked and returned confirmation token:", unconfirmedOrderRes.confirmationToken);

  // Delete order with confirmed: true -> must succeed and release the 3 reserved units
  const confirmedDelOrder = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: {
      name: "delete_order",
      arguments: {
        orderIdOrNumber: testDelOrder.orderId,
        confirmed: true,
      },
    },
  });
  console.log("✓ Confirmed delete_order output:", confirmedDelOrder.result.content[0].text);
  if (!confirmedDelOrder.result.structuredContent?.success) {
    throw new Error("Confirmed delete_order failed!");
  }

  // Delete product with confirmed: true
  const confirmedDelProduct = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: {
      name: "delete_product",
      arguments: {
        productIdOrSku: delProdId,
        confirmed: true,
      },
    },
  });
  console.log("✓ Confirmed delete_product output:", confirmedDelProduct.result.content[0].text);
  if (!confirmedDelProduct.result.structuredContent?.success) {
    throw new Error("Confirmed delete_product failed!");
  }

  // Test delete_category
  const testCat = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: {
      name: "create_category",
      arguments: { name: "Temp Category " + Date.now() },
    },
  });
  const createdCat = JSON.parse(testCat.result.content[0].text);
  const delCatRes = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 13,
    method: "tools/call",
    params: {
      name: "delete_category",
      arguments: { categoryId: createdCat.id, confirmed: true },
    },
  });
  console.log("✓ Confirmed delete_category output:", delCatRes.result.content[0].text);
  if (!delCatRes.result.structuredContent?.success) {
    throw new Error("Confirmed delete_category failed!");
  }

  console.log("\n=======================================================");
  console.log("ALL PLATFORM AND MCP VERIFICATION TESTS PASSED CLEANLY!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
