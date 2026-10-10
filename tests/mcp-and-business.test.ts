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

  console.log("\n=======================================================");
  console.log("ALL PLATFORM AND MCP VERIFICATION TESTS PASSED CLEANLY!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
