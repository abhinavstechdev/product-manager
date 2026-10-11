// MCP Apps Standard & ChatGPT UI Widgets
// Compliant with MCP Apps Specification & OpenAI ChatGPT UI Extension Guide

export const DASHBOARD_WIDGET_URI = "ui://widget/dashboard.html";
export const PRODUCTS_WIDGET_URI = "ui://widget/products.html";
export const ORDER_WIDGET_URI = "ui://widget/order.html";
export const BILL_WIDGET_URI = "ui://widget/bill.html";

const SHARED_CSS = `
  :root {
    --bg: #0b0f19;
    --card-bg: rgba(30, 41, 59, 0.7);
    --card-border: rgba(255, 255, 255, 0.08);
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --primary: #6366f1;
    --primary-hover: #4f46e5;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --radius: 12px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text-main);
    padding: 16px;
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    background: var(--card-bg);
    backdrop-filter: blur(12px);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--card-border);
  }
  .title {
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .badge-success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .badge-warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .badge-danger { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
  .badge-primary { background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }
  .stat-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 18px; font-weight: 700; color: #fff; margin-top: 4px; }
  .btn {
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn:hover { background: var(--primary-hover); transform: translateY(-1px); }
  .btn-secondary {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    border: 1px solid var(--card-border);
  }
  .btn-secondary:hover { background: rgba(255, 255, 255, 0.14); }
  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 8px;
  }
  .table th {
    text-align: left;
    padding: 8px 10px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--card-border);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
  }
  .table td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .empty-state {
    text-align: center;
    padding: 24px 16px;
    color: var(--text-muted);
  }
`;

const CLIENT_BRIDGE_JS = `
  const pendingRequests = new Map();
  let nextRequestId = 1;
  let latestToolInput = null;
  let latestToolOutput = null;

  function requestHost(method, params) {
    const id = nextRequestId++;
    window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error("Host bridge request timed out"));
        }
      }, 10000);
    });
  }

  async function callMcpTool(name, args = {}) {
    if (window.openai?.callTool) {
      return await window.openai.callTool({ name, arguments: args });
    }
    const res = await requestHost("tools/call", { name, arguments: args });
    return res?.structuredContent || res;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;

    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
      const pending = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) pending.reject(msg.error);
      else pending.resolve(msg.result);
      return;
    }

    if (msg.method === "ui/notifications/tool-input") {
      latestToolInput = msg.params;
    }

    if (msg.method === "ui/notifications/tool-result") {
      latestToolOutput = msg.params?.structuredContent || msg.params;
      if (typeof window.onToolResult === "function") {
        window.onToolResult(latestToolOutput);
      }
    }
  }, { passive: true });

  // Fallback for ChatGPT compatibility aliases
  if (window.openai?.toolOutput && typeof window.onToolResult === "function") {
    latestToolOutput = window.openai.toolOutput;
    window.onToolResult(latestToolOutput);
  }

  // Notify host that UI initialized
  window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} }, "*");
`;

// 1. DASHBOARD OVERVIEW WIDGET
export function getDashboardWidgetHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apex Executive Dashboard</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">
        <span>⚡ Apex Logistics & Retail</span>
        <span class="badge badge-primary">Live Dashboard</span>
      </div>
      <div>
        <button id="btn-refresh" class="btn btn-secondary">↻ Refresh Metrics</button>
      </div>
    </div>

    <div class="grid">
      <div class="stat-card">
        <div class="stat-label">Total Revenue</div>
        <div id="stat-revenue" class="stat-value">₹0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Physical Stock</div>
        <div id="stat-physical" class="stat-value">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Orders to Pack</div>
        <div id="stat-pack" class="stat-value" style="color: #fbbf24;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Catalog Products</div>
        <div id="stat-products" class="stat-value">0</div>
      </div>
    </div>

    <div id="stat-details" style="display: flex; gap: 8px; flex-wrap: wrap;">
      <span id="badge-avail" class="badge badge-success">Available: 0</span>
      <span id="badge-res" class="badge badge-warning">Reserved: 0</span>
      <span id="badge-low" class="badge badge-danger">Low Stock Items: 0</span>
      <span id="badge-unpaid" class="badge badge-primary">Unpaid Orders: 0</span>
    </div>
  </div>

  <script>
    ${CLIENT_BRIDGE_JS}

    function renderDashboard(data) {
      if (!data) return;
      const f = data.financials || {};
      const p = data.products || {};
      const o = data.orders || {};

      document.getElementById("stat-revenue").textContent = "₹" + Number(f.totalRevenue || 0).toLocaleString("en-IN");
      document.getElementById("stat-physical").textContent = Number(p.physicalStock || 0).toLocaleString("en-IN");
      document.getElementById("stat-pack").textContent = Number(o.toPack || 0);
      document.getElementById("stat-products").textContent = Number(p.total || 0);

      document.getElementById("badge-avail").textContent = "Available Stock: " + (p.availableStock || 0);
      document.getElementById("badge-res").textContent = "Reserved Stock: " + (p.reservedStock || 0);
      document.getElementById("badge-low").textContent = "Low Stock: " + (p.lowStockCount || 0);
      document.getElementById("badge-unpaid").textContent = "Unpaid Orders: " + (f.unpaidCount || 0);
    }

    window.onToolResult = renderDashboard;

    document.getElementById("btn-refresh").onclick = async () => {
      const btn = document.getElementById("btn-refresh");
      btn.textContent = "Updating...";
      try {
        const res = await callMcpTool("get_dashboard_summary", {});
        renderDashboard(res);
      } finally {
        btn.textContent = "↻ Refresh Metrics";
      }
    };
  </script>
</body>
</html>`;
}

// 2. PRODUCT CATALOG & INVENTORY WIDGET
export function getProductsWidgetHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apex Product Catalog</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">
        <span>📦 Product Catalog & Stock Registry</span>
      </div>
      <div>
        <button id="btn-refresh-prods" class="btn btn-secondary">↻ Refresh Catalog</button>
      </div>
    </div>

    <div style="margin-bottom: 12px; display: flex; gap: 8px;">
      <input
        id="search-input"
        type="text"
        placeholder="Filter by SKU or product name..."
        style="flex: 1; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--card-border); color: #fff; border-radius: 6px; padding: 6px 10px; font-size: 12px; outline: none;"
      />
    </div>

    <div id="table-container" style="overflow-x: auto;">
      <table class="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product Name</th>
            <th>Selling Price</th>
            <th>Physical</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="products-tbody"></tbody>
      </table>
      <div id="empty-state" class="empty-state" style="display: none;">
        No products currently in catalog. Use <code>create_product</code> to add new inventory.
      </div>
    </div>
  </div>

  <script>
    ${CLIENT_BRIDGE_JS}
    let allProducts = [];

    function renderProducts(data) {
      allProducts = Array.isArray(data) ? data : (data?.products || []);
      applyFilter();
    }

    function applyFilter() {
      const query = (document.getElementById("search-input").value || "").toLowerCase();
      const tbody = document.getElementById("products-tbody");
      const emptyEl = document.getElementById("empty-state");
      tbody.innerHTML = "";

      const filtered = allProducts.filter(p =>
        (p.name || "").toLowerCase().includes(query) || (p.sku || "").toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        emptyEl.style.display = "block";
        return;
      }
      emptyEl.style.display = "none";

      filtered.forEach(p => {
        const tr = document.createElement("tr");
        const avail = Number(p.availableStock !== undefined ? p.availableStock : (p.physicalStock - (p.reservedStock || 0)));
        let statusBadge = '<span class="badge badge-success">In Stock</span>';
        if (avail <= 0) {
          statusBadge = '<span class="badge badge-danger">Out of Stock</span>';
        } else if (avail <= (p.reorderThreshold || 10)) {
          statusBadge = '<span class="badge badge-warning">Low Stock</span>';
        }

        tr.innerHTML = \`
          <td style="font-weight: 600; font-family: monospace; color: #818cf8;">\${p.sku || "—"}</td>
          <td>\${p.name || "—"}</td>
          <td>₹\${Number(p.sellingPrice || 0).toLocaleString("en-IN")}</td>
          <td>\${p.physicalStock || 0}</td>
          <td style="color: #fbbf24;">\${p.reservedStock || 0}</td>
          <td style="font-weight: 700; color: \${avail > 0 ? '#34d399' : '#f87171'};">\${avail}</td>
          <td>\${statusBadge}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    window.onToolResult = renderProducts;

    document.getElementById("search-input").addEventListener("input", applyFilter);

    document.getElementById("btn-refresh-prods").onclick = async () => {
      const btn = document.getElementById("btn-refresh-prods");
      btn.textContent = "Updating...";
      try {
        const res = await callMcpTool("list_products", {});
        renderProducts(res);
      } finally {
        btn.textContent = "↻ Refresh Catalog";
      }
    };
  </script>
</body>
</html>`;
}

// 3. ORDER INSPECTOR WIDGET
export function getOrderWidgetHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apex Order Inspector</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">
        <span id="order-num">📋 Order Details</span>
        <span id="order-status-badge" class="badge badge-primary">STATUS</span>
      </div>
      <div>
        <span id="order-payment-badge" class="badge badge-warning">PAYMENT</span>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr;">
      <div class="stat-card">
        <div class="stat-label">Customer Information</div>
        <div id="cust-name" style="font-weight: 600; margin-top: 4px;">—</div>
        <div id="cust-phone" style="font-size: 11px; color: var(--text-muted);">—</div>
        <div id="cust-address" style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Order Financials</div>
        <div id="order-total" class="stat-value">₹0</div>
        <div id="order-source" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Source: —</div>
      </div>
    </div>

    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
        Line Items
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Item Name</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody id="items-tbody"></tbody>
      </table>
    </div>

    <div id="action-bar" style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--card-border); display: flex; gap: 8px;">
      <button id="btn-pack" class="btn" style="display: none;">📦 Mark as Packed</button>
      <button id="btn-ship" class="btn btn-secondary" style="display: none;">🚚 Dispatch Shipment</button>
    </div>
  </div>

  <script>
    ${CLIENT_BRIDGE_JS}
    let currentOrder = null;

    function renderOrder(data) {
      if (!data) return;
      currentOrder = data;

      document.getElementById("order-num").textContent = "📋 Order " + (data.orderNumber || data.id || "—");

      // Status Badge
      const status = data.status || "NEW";
      const statusBadge = document.getElementById("order-status-badge");
      statusBadge.textContent = status;
      statusBadge.className = "badge " + (
        status === "DELIVERED" ? "badge-success" :
        status === "SHIPPED" || status === "PACKED" ? "badge-primary" :
        status === "CANCELLED" ? "badge-danger" : "badge-warning"
      );

      // Payment Badge
      const payStatus = data.paymentStatus || "UNPAID";
      const payBadge = document.getElementById("order-payment-badge");
      payBadge.textContent = payStatus;
      payBadge.className = "badge " + (
        payStatus === "PAID" ? "badge-success" :
        payStatus === "PARTIALLY_PAID" ? "badge-warning" : "badge-danger"
      );

      // Customer
      document.getElementById("cust-name").textContent = data.customer?.name || data.customerName || "Customer";
      document.getElementById("cust-phone").textContent = data.customer?.phone || data.customerPhone || "";
      document.getElementById("cust-address").textContent = data.shippingAddress || "Standard Delivery";

      // Total & Source
      document.getElementById("order-total").textContent = "₹" + Number(data.totalAmount || 0).toLocaleString("en-IN");
      document.getElementById("order-source").textContent = "Source: " + (data.source || "Direct");

      // Line items
      const tbody = document.getElementById("items-tbody");
      tbody.innerHTML = "";
      const items = data.items || [];
      items.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = \`
          <td style="font-family: monospace; color: #818cf8;">\${item.sku || "—"}</td>
          <td>\${item.productName || item.name || item.product?.name || "Item"}</td>
          <td style="font-weight: 600;">\${item.quantity || 1}</td>
          <td>₹\${Number(item.unitPrice || 0).toLocaleString("en-IN")}</td>
          <td style="font-weight: 600;">₹\${Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toLocaleString("en-IN")}</td>
        \`;
        tbody.appendChild(tr);
      });

      // Action Buttons
      const packBtn = document.getElementById("btn-pack");
      const shipBtn = document.getElementById("btn-ship");

      if (status === "CONFIRMED" || status === "PROCESSING" || status === "NEW") {
        packBtn.style.display = "inline-flex";
      } else {
        packBtn.style.display = "none";
      }

      if (status === "PACKED") {
        shipBtn.style.display = "inline-flex";
      } else {
        shipBtn.style.display = "none";
      }
    }

    window.onToolResult = renderOrder;

    document.getElementById("btn-pack").onclick = async () => {
      if (!currentOrder) return;
      const btn = document.getElementById("btn-pack");
      btn.textContent = "Packing...";
      try {
        await callMcpTool("mark_order_packed", { orderId: currentOrder.id || currentOrder.orderNumber });
        const refreshed = await callMcpTool("get_order", { orderIdOrNumber: currentOrder.id || currentOrder.orderNumber });
        renderOrder(refreshed);
      } finally {
        btn.textContent = "📦 Mark as Packed";
      }
    };

    document.getElementById("btn-ship").onclick = async () => {
      if (!currentOrder) return;
      const btn = document.getElementById("btn-ship");
      btn.textContent = "Dispatching...";
      try {
        await callMcpTool("mark_order_shipped", {
          orderId: currentOrder.id || currentOrder.orderNumber,
          courier: "Blue Dart Express",
          trackingNumber: "TRK" + Date.now().toString().slice(-8)
        });
        const refreshed = await callMcpTool("get_order", { orderIdOrNumber: currentOrder.id || currentOrder.orderNumber });
        renderOrder(refreshed);
      } finally {
        btn.textContent = "🚚 Dispatch Shipment";
      }
    };
  </script>
</body>
</html>`;
}

export function getBillWidgetHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Digital Tax Invoice Widget</title>
  <style>
    ${SHARED_CSS}
    .invoice-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-cancelled { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .status-paid { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .status-pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">
          <span>🧾 Tax Invoice / Bill of Supply</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;" id="company-name">Apex Logistics</div>
      </div>
      <div style="text-align: right;">
        <span id="bill-status-badge" class="invoice-badge status-pending">LOADING</span>
        <div style="font-family: monospace; font-size: 11px; color: #818cf8; margin-top: 4px;" id="bill-invoice-num">—</div>
      </div>
    </div>

    <!-- Customer & Date -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; font-size: 11px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
      <div>
        <span style="color: var(--text-muted); font-size: 9px; text-transform: uppercase; font-weight: 700; display: block;">Billed To:</span>
        <span id="bill-cust-name" style="font-weight: 700; color: #fff;">—</span>
        <div id="bill-cust-phone" style="color: var(--text-muted); font-family: monospace;">—</div>
      </div>
      <div>
        <span style="color: var(--text-muted); font-size: 9px; text-transform: uppercase; font-weight: 700; display: block;">Invoice Date:</span>
        <span id="bill-date" style="color: #fff;">—</span>
        <div id="bill-payment-mode" style="color: var(--text-muted);">—</div>
      </div>
    </div>

    <!-- Cancellation Notice if cancelled -->
    <div id="bill-cancelled-box" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 11px;">
      <span style="font-weight: 700; color: #f87171;">⚠️ This Order is Cancelled</span>
      <div id="bill-cancelled-reason" style="color: #fca5a5; margin-top: 2px;">—</div>
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Description</th>
          <th>Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody id="bill-items-body">
        <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Loading items...</td></tr>
      </tbody>
    </table>

    <!-- Financial Breakdown -->
    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--card-border); font-size: 11px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: var(--text-muted);">Subtotal:</span>
        <span id="bill-subtotal" style="font-family: monospace; font-weight: 600;">₹0.00</span>
      </div>
      <div id="bill-discount-row" style="display: none; justify-content: space-between; margin-bottom: 4px; color: #34d399;">
        <span>Order Discount:</span>
        <span id="bill-discount" style="font-family: monospace; font-weight: 600;">-₹0.00</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: var(--text-muted);">Shipping:</span>
        <span id="bill-shipping" style="font-family: monospace; font-weight: 600;">₹0.00</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 13px; font-weight: 800;">
        <span id="bill-total-label">Total Amount:</span>
        <span id="bill-total" style="font-family: monospace; color: #818cf8;">₹0.00</span>
      </div>

      <!-- Cancellation Deduction rows if cancelled -->
      <div id="bill-cancellation-rows" style="display: none; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(239,68,68,0.3); font-size: 11px;">
        <div style="display: flex; justify-content: space-between; color: #f87171;">
          <span>Cancellation Deduction Fee:</span>
          <span id="bill-cancel-fee" style="font-family: monospace; font-weight: 700;">-₹0.00</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #34d399; font-size: 13px; font-weight: 800; margin-top: 4px;">
          <span>Net Refund / Payable:</span>
          <span id="bill-net-refund" style="font-family: monospace;">₹0.00</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div style="display: flex; gap: 8px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--card-border);">
      <a id="btn-view-digital" href="#" target="_blank" class="btn btn-primary" style="text-decoration: none; font-size: 11px; flex: 1; text-align: center;">
        🌐 View Digital Bill URL
      </a>
      <a id="btn-print-bill" href="#" target="_blank" class="btn btn-secondary" style="text-decoration: none; font-size: 11px; text-align: center;">
        🖨️ Print Invoice
      </a>
    </div>
  </div>

  <script>
    function renderBill(data) {
      if (!data) return;
      const order = data.order || data;
      const customer = data.customer || {};
      const company = data.company || {};
      const items = data.items || [];

      document.getElementById("company-name").textContent = company.name || "Apex Logistics";
      document.getElementById("bill-invoice-num").textContent = data.invoiceNumber || ("INV-" + (order.orderNumber || ""));
      document.getElementById("bill-cust-name").textContent = customer.name || "Direct Customer";
      document.getElementById("bill-cust-phone").textContent = customer.phone || "—";
      document.getElementById("bill-date").textContent = new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
      });
      document.getElementById("bill-payment-mode").textContent = order.paymentMethod || "Cash on Delivery";

      // Status badge
      const badge = document.getElementById("bill-status-badge");
      if (order.status === "CANCELLED") {
        badge.textContent = "CANCELLED";
        badge.className = "invoice-badge status-cancelled";
        document.getElementById("bill-cancelled-box").style.display = "block";
        document.getElementById("bill-cancelled-reason").textContent = order.cancellationReason || "Order cancelled as per policy";
        document.getElementById("bill-total-label").textContent = "Original Order Total:";
        document.getElementById("bill-cancellation-rows").style.display = "block";
        document.getElementById("bill-cancel-fee").textContent = "-₹" + Number(order.cancellationFee || 0).toFixed(2);
        document.getElementById("bill-net-refund").textContent = "₹" + Number(order.refundAmount || (order.totalAmount - (order.cancellationFee || 0))).toFixed(2);
      } else if (order.paymentStatus === "PAID") {
        badge.textContent = "PAID IN FULL";
        badge.className = "invoice-badge status-paid";
      } else {
        badge.textContent = order.status || "CONFIRMED";
        badge.className = "invoice-badge status-pending";
      }

      // Items
      const tbody = document.getElementById("bill-items-body");
      tbody.innerHTML = "";
      items.forEach(it => {
        const tr = document.createElement("tr");
        tr.innerHTML = \`
          <td style="font-family: monospace; color: #818cf8;">\${it.sku || "—"}</td>
          <td>\${it.productName || it.name || "Item"}</td>
          <td style="font-weight: 600;">\${it.quantity}</td>
          <td style="text-align: right; font-family: monospace;">₹\${Number(it.totalPrice || (it.quantity * it.unitPrice) || 0).toFixed(2)}</td>
        \`;
        tbody.appendChild(tr);
      });

      // Totals
      document.getElementById("bill-subtotal").textContent = "₹" + Number(order.subtotal || 0).toFixed(2);
      document.getElementById("bill-shipping").textContent = Number(order.shippingFee || 0) > 0 ? ("₹" + Number(order.shippingFee).toFixed(2)) : "FREE";
      document.getElementById("bill-total").textContent = "₹" + Number(order.totalAmount || 0).toFixed(2);

      if (Number(order.discount || 0) > 0) {
        document.getElementById("bill-discount-row").style.display = "flex";
        document.getElementById("bill-discount").textContent = "-₹" + Number(order.discount).toFixed(2);
      }

      // URLs
      const digitalUrl = data.digitalBillUrl || ("/bill/" + (order.id || order.orderNumber));
      document.getElementById("btn-view-digital").href = digitalUrl;
      document.getElementById("btn-print-bill").href = digitalUrl + "?print=true";
    }

    window.onToolResult = renderBill;
  </script>
</body>
</html>`;
}
