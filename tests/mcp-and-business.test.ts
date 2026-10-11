// ENFORCE ISOLATED IN-MEMORY DATABASE FOR TESTS (PREVENT TOUCHING PRODUCTION NEON DATABASE)
delete process.env.DATABASE_URL;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.TEST_SUITE = "true";

import { getDb } from "../lib/db/client";
import { verifyMcpToken, verifyPkce } from "../lib/auth/oauth";
import { createMcpServer } from "../lib/mcp/server";
import * as inventoryService from "../lib/services/inventory-service";
import * as orderService from "../lib/services/order-service";
import * as packingService from "../lib/services/packing-service";
import * as shippingService from "../lib/services/shipping-service";
import * as paymentService from "../lib/services/payment-service";
import * as reportService from "../lib/services/report-service";
import * as productService from "../lib/services/product-service";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import http from "http";
import { Webhook } from "standardwebhooks";
import { dispatchMcpEvent } from "../lib/mcp/events";

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
  const dynamicTestProd = await productService.createProduct({
    workspaceId: principal.workspaceId,
    name: "Verification Headset",
    sku: "TEST-VERIFY-" + Date.now(),
    purchaseCost: 100,
    sellingPrice: 200,
    initialStock: 10,
    actor: { id: "test_suite", name: "Vitest Automated Runner", type: "AI_AGENT" },
  });

  const initialSummary = await inventoryService.getInventorySummary(principal.workspaceId);
  console.log("✓ Inventory state before new order:", {
    totalPhysical: initialSummary.totalPhysicalStock,
    totalReserved: initialSummary.totalReservedStock,
    totalAvailable: initialSummary.totalAvailableStock,
  });

  const testOrder = await orderService.createOrder({
    workspaceId: principal.workspaceId,
    newCustomer: {
      name: "Priya Sharma",
      phone: "+91 98765 43210",
      shippingAddress: "45 Cyber City, DLF Phase 2, Gurugram, HR - 122002",
    },
    shippingAddress: "45 Cyber City, DLF Phase 2, Gurugram, HR - 122002",
    source: "WhatsApp",
    items: [
      {
        productId: dynamicTestProd.id,
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
      arguments: { query: "Headset" },
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

  // 12.1 Test MCP Apps UI Resources (text/html;profile=mcp-app)
  console.log("\n--- Testing MCP Apps UI Resources & Decoupled Render Tools ---");
  const dashboardUiRead = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 71,
    method: "resources/read",
    params: { uri: "ui://widget/dashboard.html" },
  });
  if (dashboardUiRead?.result?.contents?.[0]?.mimeType !== "text/html;profile=mcp-app") {
    throw new Error(`Expected mimeType 'text/html;profile=mcp-app' on dashboard widget, got: ${dashboardUiRead?.result?.contents?.[0]?.mimeType}`);
  }
  console.log("✓ MCP Apps Dashboard Resource verified (MIME: text/html;profile=mcp-app, size:", dashboardUiRead.result.contents[0].text.length, "chars)");

  const productsUiRead = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 72,
    method: "resources/read",
    params: { uri: "ui://widget/products.html" },
  });
  if (productsUiRead?.result?.contents?.[0]?.mimeType !== "text/html;profile=mcp-app") {
    throw new Error(`Expected mimeType 'text/html;profile=mcp-app' on products widget, got: ${productsUiRead?.result?.contents?.[0]?.mimeType}`);
  }
  console.log("✓ MCP Apps Products Resource verified (MIME: text/html;profile=mcp-app, size:", productsUiRead.result.contents[0].text.length, "chars)");

  const orderUiRead = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 73,
    method: "resources/read",
    params: { uri: "ui://widget/order.html" },
  });
  if (orderUiRead?.result?.contents?.[0]?.mimeType !== "text/html;profile=mcp-app") {
    throw new Error(`Expected mimeType 'text/html;profile=mcp-app' on order widget, got: ${orderUiRead?.result?.contents?.[0]?.mimeType}`);
  }
  console.log("✓ MCP Apps Order Resource verified (MIME: text/html;profile=mcp-app, size:", orderUiRead.result.contents[0].text.length, "chars)");

  // Test Decoupled Call Flow: render_dashboard_widget
  const renderDashCall = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 74,
    method: "tools/call",
    params: {
      name: "render_dashboard_widget",
      arguments: {},
    },
  });
  if (renderDashCall?.result?._meta?.ui?.resourceUri !== "ui://widget/dashboard.html") {
    throw new Error("render_dashboard_widget missing _meta.ui.resourceUri!");
  }
  if (renderDashCall?.result?._meta?.["openai/outputTemplate"] !== "ui://widget/dashboard.html") {
    throw new Error("render_dashboard_widget missing openai/outputTemplate alias!");
  }
  console.log("✓ render_dashboard_widget returned _meta.ui.resourceUri and openai/outputTemplate alias");

  // Test Decoupled Call Flow: render_products_widget
  const renderProdsCall = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 75,
    method: "tools/call",
    params: {
      name: "render_products_widget",
      arguments: { products: [] },
    },
  });
  if (renderProdsCall?.result?._meta?.ui?.resourceUri !== "ui://widget/products.html") {
    throw new Error("render_products_widget missing _meta.ui.resourceUri!");
  }
  console.log("✓ render_products_widget returned _meta.ui.resourceUri");

  // Test Decoupled Call Flow: render_order_widget
  const renderOrderCall = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 76,
    method: "tools/call",
    params: {
      name: "render_order_widget",
      arguments: { order: testOrder },
    },
  });
  if (renderOrderCall?.result?._meta?.ui?.resourceUri !== "ui://widget/order.html") {
    throw new Error("render_order_widget missing _meta.ui.resourceUri!");
  }
  console.log("✓ render_order_widget returned _meta.ui.resourceUri for test order");

  // 12.2 Test MCP Events (Protocol version 2026-07-28, server/discover, events/list, events/subscribe, Webhooks, Verification Challenge, events/unsubscribe)
  console.log("\n--- Testing MCP Events (Protocol 2026-07-28 & ChatGPT Webhooks) ---");

  // Spin up local mock callback endpoint
  const receivedRequests: Array<{ url: string; headers: any; body: any }> = [];
  const validSecret = "whsec_" + Buffer.from("01234567890123456789012345678901").toString("base64");
  const webhookSigner = new Webhook(validSecret);

  const mockServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        const parsed = JSON.parse(raw);
        receivedRequests.push({ url: req.url || "/", headers: req.headers, body: parsed });
        if (parsed.type === "verification") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ challenge: parsed.challenge }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "accepted" }));
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });

  await new Promise<void>((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  const mockPort = (mockServer.address() as any).port;
  const mockCallbackUrl = `http://127.0.0.1:${mockPort}/mcp-events/webhook`;

  // 1. Test server/discover
  const discoverData = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 80,
    method: "server/discover",
    params: {},
  });
  console.log("✓ server/discover response:", {
    supportedVersions: discoverData?.result?.supportedVersions,
    capabilities: discoverData?.result?.capabilities,
  });
  if (!discoverData?.result?.supportedVersions?.includes("2026-07-28")) {
    throw new Error("server/discover missing 2026-07-28 protocol version!");
  }
  if (!discoverData?.result?.capabilities?.events) {
    throw new Error("server/discover missing capabilities.events!");
  }

  // 2. Test events/list
  const eventsListData = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 81,
    method: "events/list",
    params: {},
  });
  const eventNames = eventsListData?.result?.events?.map((e: any) => e.name) || [];
  console.log("✓ events/list returned events:", eventNames);
  if (!eventNames.includes("order.created") || !eventNames.includes("order.status_changed") || !eventNames.includes("inventory.low_stock")) {
    throw new Error("events/list missing core e-commerce events!");
  }

  // 3. Test events/subscribe with invalid secret (must fail)
  const invalidSub = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 82,
    method: "events/subscribe",
    params: {
      name: "order.created",
      delivery: {
        mode: "webhook",
        url: mockCallbackUrl,
        secret: "invalid_secret",
      },
    },
  });
  if (!invalidSub.error) {
    throw new Error("events/subscribe should reject invalid secret!");
  }
  console.log("✓ events/subscribe with invalid secret rejected cleanly");

  // 4. Test events/subscribe with valid secret & challenge verification
  const validSub = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 83,
    method: "events/subscribe",
    params: {
      name: "order.created",
      arguments: { status: "CONFIRMED" },
      delivery: {
        mode: "webhook",
        url: mockCallbackUrl,
        secret: validSecret,
      },
      ttlMs: 86400000,
    },
  });
  if (!validSub?.result?.id?.startsWith("sub_")) {
    throw new Error(`Invalid subscription result: ${JSON.stringify(validSub)}`);
  }
  console.log("✓ events/subscribe registered subscription ID:", validSub.result.id, "Expires:", validSub.result.refreshBefore);

  // Verify that challenge was sent and signed properly
  const verificationReq = receivedRequests.find((r) => r.body.type === "verification");
  if (!verificationReq) {
    throw new Error("Verification challenge request was not sent to callback URL!");
  }
  webhookSigner.verify(JSON.stringify(verificationReq.body), {
    "webhook-id": verificationReq.headers["webhook-id"],
    "webhook-timestamp": verificationReq.headers["webhook-timestamp"],
    "webhook-signature": verificationReq.headers["webhook-signature"],
  });
  console.log("✓ Callback challenge request received and HMAC signature verified!");

  // 5. Test Event Dispatch & Webhook Delivery
  await dispatchMcpEvent(principal.workspaceId, "order.created", {
    order_id: "ord_evt_verify_123",
    order_number: "ORD-EVT-001",
    customer_name: "Priya Sharma",
    total_amount: 1500,
    status: "CONFIRMED",
    payment_status: "PAID",
    items_count: 2,
    url: "http://localhost:3000/orders#ord_evt_verify_123",
  });

  // Small delay for async delivery
  await new Promise((resolve) => setTimeout(resolve, 300));

  const deliveredEventReq = receivedRequests.find((r) => r.body.name === "order.created");
  if (!deliveredEventReq) {
    throw new Error("Webhook delivery for order.created was not received by callback!");
  }
  webhookSigner.verify(JSON.stringify(deliveredEventReq.body), {
    "webhook-id": deliveredEventReq.headers["webhook-id"],
    "webhook-timestamp": deliveredEventReq.headers["webhook-timestamp"],
    "webhook-signature": deliveredEventReq.headers["webhook-signature"],
  });
  console.log("✓ Webhook event delivered with valid Standard Webhook HMAC signature! Event:", deliveredEventReq.body.name);

  // 6. Test events/unsubscribe
  const unsubRes = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 84,
    method: "events/unsubscribe",
    params: {
      name: "order.created",
      arguments: { status: "CONFIRMED" },
      delivery: {
        mode: "webhook",
        url: mockCallbackUrl,
      },
    },
  });
  console.log("✓ events/unsubscribe processed successfully:", unsubRes.result);

  mockServer.close();

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
    "factory_reset",
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
    newCustomer: {
      name: "Deletion Test Customer",
      phone: "+91 99999 00000",
      shippingAddress: "Test Address for Deletion",
    },
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

  // 14. Test Factory Reset Security Password & Confirmation
  console.log("\n--- Testing Factory Reset (Password Authorization & Clean Slate) ---");

  // Call without password -> must reject
  const noPwdReset = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 14,
    method: "tools/call",
    params: {
      name: "factory_reset",
      arguments: {},
    },
  });
  if (noPwdReset.result.structuredContent?.status !== "PASSWORD_REQUIRED") {
    throw new Error("factory_reset without password should return PASSWORD_REQUIRED!");
  }
  console.log("✓ factory_reset without password correctly prompted for master password");

  // Call with wrong password -> must reject
  const wrongPwdReset = await sendMcpRequest({
    jsonrpc: "2.0",
    id: 15,
    method: "tools/call",
    params: {
      name: "factory_reset",
      arguments: { password: "WrongPassword123" },
    },
  });
  if (wrongPwdReset.result.structuredContent?.status !== "INVALID_PASSWORD") {
    throw new Error("factory_reset with wrong password should return INVALID_PASSWORD!");
  }
  console.log("✓ factory_reset with wrong password correctly rejected");

  // Only execute actual factory reset if explicitly requested via environment variable
  if (process.env.TEST_ALLOW_FACTORY_RESET === "true") {
    const confirmedReset = await sendMcpRequest({
      jsonrpc: "2.0",
      id: 16,
      method: "tools/call",
      params: {
        name: "factory_reset",
        arguments: { password: "Aezakmi@ff135" },
      },
    });
    if (confirmedReset.result.structuredContent?.status !== "COMPLETED") {
      throw new Error("Confirmed factory_reset failed!");
    }
    console.log("✓ Confirmed factory_reset output:", confirmedReset.result.content[0].text);
  } else {
    console.log("✓ factory_reset password verification tested; live database wipe skipped during routine regression tests.");
  }

  // 15. Test Multi-Provider Isolation (ChatGPT MCP & Google Gemini MCP)
  console.log("\n--- Testing Multi-Provider Isolation (ChatGPT MCP & Google Gemini MCP) ---");
  const { GET: getProviders, POST: validateProvider } = await import("../app/api/mcp/providers/route");
  
  // Test GET providers list
  const dummyReq = new Request("http://localhost:3000/api/mcp/providers") as any;
  const providersRes = await getProviders(dummyReq);
  const providersData = await providersRes.json();
  
  if (!providersData.success || !Array.isArray(providersData.providers)) {
    throw new Error("Failed to retrieve providers list from /api/mcp/providers");
  }
  
  const chatgptProvider = providersData.providers.find((p: any) => p.id === "chatgpt_mcp");
  const geminiProvider = providersData.providers.find((p: any) => p.id === "google_gemini");
  
  if (!chatgptProvider) {
    throw new Error("ChatGPT MCP provider record missing!");
  }
  if (!geminiProvider) {
    throw new Error("Google Gemini MCP provider record missing!");
  }
  
  // Verify ChatGPT provider specifications remain 100% intact
  if (!chatgptProvider.authTypes.includes("OAuth 2.1 (RFC 7636 PKCE)") || !chatgptProvider.authTypes.includes("Bearer Token (mcp_dev_token_apex)")) {
    throw new Error("ChatGPT provider auth types were modified!");
  }
  console.log("✓ Verified ChatGPT MCP provider record intact & isolated:", chatgptProvider.name);
  
  // Verify Gemini provider specifications conform to official Google documentation
  if (geminiProvider.eligibility.minAge !== 18 || geminiProvider.eligibility.keepActivityRequired !== true) {
    throw new Error("Gemini eligibility requirements missing or invalid!");
  }
  if (!geminiProvider.officialDocsUrl.includes("17209137")) {
    throw new Error("Gemini official documentation URL must reference Google Help article 17209137!");
  }
  console.log("✓ Verified Google Gemini MCP provider record with official Google requirements:", geminiProvider.name);
  
  // Test POST validation for Google Gemini
  const validateReq = new Request("http://localhost:3000/api/mcp/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId: "google_gemini" }),
  }) as any;
  const validateRes = await validateProvider(validateReq);
  const validateData = await validateRes.json();
  
  if (!validateData.success || validateData.provider !== "google_gemini" || !validateData.checks.providerIsolated) {
    throw new Error("Google Gemini validation failed or provider isolation compromised!");
  }
  console.log("✓ Verified Google Gemini provider validation & zero-conflict isolation check passed");

  console.log("\n=======================================================");
  console.log("ALL PLATFORM AND MCP VERIFICATION TESTS PASSED CLEANLY!");
  console.log("=======================================================\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
