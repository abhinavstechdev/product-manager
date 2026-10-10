# Apex AI Inventory & Order Management Platform

A production-grade, multi-tenant Inventory, Product, Customer, and Manual Order Management System deployable to Vercel on free-tier services, featuring both a human-facing web dashboard and an authenticated remote Model Context Protocol (MCP) server over Streamable HTTP with OAuth 2.1 authorization.

---

## Architecture Overview

```
AI ASSISTANTS (Claude Desktop / Cursor / Antigravity)
        │
        │ OAuth 2.1 (RFC 7636 PKCE S256)
        │ Streamable HTTP Transport
        ▼
   POST /api/mcp
        │
        ▼
   PERMISSION CHECKS & RISK CLASSIFICATION
   (High-Impact Confirmation Policy)
        │
        ▼
   SHARED BUSINESS LOGIC & LEDGER ENGINE  ◄─── HUMAN DASHBOARD (Next.js)
        │
        ▼
   POSTGRESQL DATABASE (Neon / Pooled PG)
   (Multi-Tenant Workspace Scoped Records)
```

---

## Key Features

1. **Dual Access Interface**:
   - Polished Web Dashboard for human operators (dark slate aesthetic, status badges, responsive workflows).
   - Remote MCP Server (`POST /api/mcp`) exposing **72 production-grade tools**, resources, and prompts to AI assistants.

2. **Strict Inventory Allocation Engine**:
   - Mathematical formula: `Available Stock = Physical Stock - Reserved Stock`
   - Real-time stock movements ledger with audit trail (`OPENING_STOCK`, `STOCK_RECEIVED`, `MANUAL_ADJUSTMENT`, `STOCK_RESERVED`, `RESERVATION_RELEASED`, `ORDER_DISPATCHED`, `RETURN_APPROVED_RESALE`, `DAMAGED_GOODS`).
   - Overselling prevention: orders automatically reserve stock upon creation.
   - Atomic transactions: shipping an order atomically reduces physical stock and releases reservation.

3. **Complete Order Lifecycle & Workflows**:
   - Order sequential numbering: `ORD-YYYY-NNNNNN`
   - Lifecycle state machine: `NEW -> CONFIRMED -> PROCESSING -> PACKED -> SHIPPED -> DELIVERED / CANCELLED / RETURNED`
   - Dedicated warehouse packing queue with printable packing slips.
   - Courier shipping dispatch with AWB tracking numbers.
   - Payment collection accounting (Cash, Cash on Delivery, UPI, NEFT) with partial settlements.
   - Quality control returns quarantine and resale approval.

4. **Remote MCP Server (`/api/mcp`)**:
   - Built with the official `@modelcontextprotocol/sdk` TypeScript SDK.
   - Web standard Streamable HTTP transport configured for stateless serverless execution on Vercel.
   - 72 granular tools covering dashboard, products, inventory, customers, orders, packing, shipping, payments, returns, and reports.
   - High-impact write safety policy: actions like stock deductions and order cancellations require confirmation tokens.

5. **OAuth 2.1 Authorization**:
   - RFC 8414 Authorization Server Metadata: `/.well-known/oauth-authorization-server`
   - RFC 9728 Protected Resource Metadata: `/.well-known/oauth-protected-resource`
   - RFC 7636 PKCE (S256 code challenge verification).
   - Authorization code issuance (`/api/oauth/authorize`), Token issuance (`/api/oauth/token`), and Token revocation (`/api/oauth/revoke`).

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- npm or pnpm

### 2. Installation
```bash
git clone <repo-url>
cd productmanager
npm install
```

### 3. Running Locally
The application automatically defaults to an embedded real PostgreSQL engine (PGlite) with seeded demo data ("Apex Logistics & Retail") when running offline without external configuration:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running Verification Tests
```bash
npm test
```
Runs end-to-end integration tests validating database schema, PKCE S256 calculations, OAuth Bearer tokens, atomic stock reservations, packing, shipping, payments, and MCP JSON-RPC tool calls.

---

## Free-Tier Deployment to Vercel + Neon PostgreSQL

### 1. Provision Managed PostgreSQL (Neon Free Tier)
1. Sign up at [neon.tech](https://neon.tech) (Free tier includes 0.5 GB storage and pooled connections).
2. Create a project named `apex-inventory`.
3. Copy the pooled connection string:
   ```
   postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Push Migrations
Run Drizzle Kit to apply migrations to your Neon database:
```bash
DATABASE_URL="your-neon-connection-string" npx drizzle-kit push
```

### 3. Deploy on Vercel
1. Push your repository to GitHub.
2. In Vercel, click **Add New Project** and import the repository.
3. Configure Environment Variables:
   - `DATABASE_URL`: `postgresql://...` (your Neon pooled connection string)
   - `AUTH_SECRET`: Generate a 32+ character random secret string
   - `APP_BASE_URL`: `https://your-app-name.vercel.app`
   - `MCP_SERVER_URL`: `https://your-app-name.vercel.app/api/mcp`
4. Deploy!

---

## Connecting AI Assistants (Claude Desktop / Cursor)

### Claude Desktop Configuration
Add the remote MCP server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apexInventory": {
      "url": "https://your-app-name.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer mcp_dev_token_apex"
      }
    }
  }
}
```

### Example Natural Language Prompts
- *"Show me all orders currently waiting in the warehouse packing queue."*
- *"Find all products with fewer than 10 units in stock and check their reorder thresholds."*
- *"Create a manual WhatsApp order for customer Priya Sharma for 2 units of SKU AUD-ANC-001."*
- *"Mark order ORD-2026-000102 as packed."*
- *"Ship order ORD-2026-000102 via Blue Dart with tracking BD982190342IN."*
- *"Record a payment of ₹4,599 via UPI for order ORD-2026-000101."*
- *"Generate the monthly sales report and summarize receivables."*

---

## Registered MCP Tools Catalog (72 Tools)

| Category | Available Tools |
| :--- | :--- |
| **Dashboard & Search** | `get_dashboard_summary`, `get_business_overview`, `search_business_records`, `get_recent_activity`, `get_low_stock_products`, `get_out_of_stock_products` |
| **Products & Catalog** | `list_products`, `search_products`, `get_product`, `create_product`, `update_product`, `archive_product`, `list_categories`, `create_category`, `update_category` |
| **Inventory & Ledger** | `get_inventory_summary`, `get_product_stock`, `get_available_stock`, `get_reserved_stock`, `list_inventory_transactions`, `adjust_inventory`, `receive_inventory`, `get_low_stock_report`, `get_inventory_valuation` |
| **Customers** | `list_customers`, `search_customers`, `get_customer`, `create_customer`, `update_customer`, `get_customer_order_history` |
| **Orders** | `list_orders`, `search_orders`, `get_order`, `create_order`, `update_order`, `get_order_items`, `get_order_history`, `add_order_note`, `confirm_order`, `process_order`, `cancel_order` |
| **Packing** | `list_orders_to_pack`, `get_packing_queue`, `get_packing_details`, `get_packing_slip`, `mark_order_packed` |
| **Shipping** | `list_orders_to_ship`, `get_shipping_queue`, `get_shipped_orders`, `get_shipment_details`, `update_shipping_details`, `mark_order_shipped`, `mark_order_delivered` |
| **Payments** | `list_payments`, `get_order_payment_status`, `record_payment`, `get_unpaid_orders`, `get_partial_payment_orders`, `get_payment_summary` |
| **Returns & QC** | `list_returns`, `get_return_details`, `register_return`, `approve_return`, `reject_return` |
| **Reports & Export** | `get_sales_report`, `get_order_report`, `get_inventory_report`, `get_product_performance`, `get_payment_report`, `get_cancellation_report`, `get_return_report`, `export_report_csv` |

---

## License
MIT
