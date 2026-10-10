import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpAuthPrincipal } from "../auth/oauth";
import { hasMcpScope, McpScope } from "../permissions/roles";
import * as inventoryService from "../services/inventory-service";
import * as orderService from "../services/order-service";
import * as packingService from "../services/packing-service";
import * as shippingService from "../services/shipping-service";
import * as paymentService from "../services/payment-service";
import * as returnService from "../services/return-service";
import * as productService from "../services/product-service";
import * as customerService from "../services/customer-service";
import * as reportService from "../services/report-service";
import * as confirmationService from "../services/confirmation-service";
import * as resetService from "../services/reset-service";
import { getDb } from "../db/client";
import { auditEvents, orders, products, workspaces } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { registerSkillsExtension } from "./skills";
import { registerEventsExtension } from "./events";
import { getBaseUrl } from "../config/urls";
import {
  DASHBOARD_WIDGET_URI,
  PRODUCTS_WIDGET_URI,
  ORDER_WIDGET_URI,
  getDashboardWidgetHtml,
  getProductsWidgetHtml,
  getOrderWidgetHtml,
} from "./widgets";

export function createMcpServer(principal: McpAuthPrincipal) {
  const server = new McpServer(
    {
      name: "apex-commerce",
      version: "1.0.0",
    },
    {
      instructions:
        "Apex Inventory & Order Management Platform. Core rules: Available stock = Physical - Reserved. Always verify product SKU using get_product or search before creating orders or adjustments. For category management: use list_categories to see available categories with product counts, get_product_category to inspect a product's current category, update_product_category to move a product to a new category (e.g. moving MAKA-SC-001 from Lip Care to Skin Care), bulk_update_product_categories for batch reassignment (defaults to dryRun: true for safety preview), suggest_product_category for intelligent category recommendations based on product name and description, and create_category_if_missing to avoid duplicate categories. Destructive operations (delete_product, delete_order, delete_customer, delete_category, delete_payment, delete_return, factory_reset) and high-impact operations (negative stock adjustments, order cancellations) require confirmation in compliance with the ChatGPT MCP specification. Factory reset (factory_reset) requires asking the operator for the master security password ('Aezakmi@ff135') before execution. Packing slips exclude customer payment details. Delivered status does not mark order as paid. Use get_user_profile to identify operator context. For UI, follow the decoupled pattern: call data tools (get_dashboard_summary, list_products, get_order) to fetch data, then render tools (render_dashboard_widget, render_products_widget, render_order_widget) to display interactive components. For real-time updates and notifications, MCP Events (protocol version 2026-07-28) allows ChatGPT to subscribe to updates (order.created, order.status_changed, inventory.low_stock, inventory.adjusted, return.requested) via signed webhooks.",
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
        prompts: { listChanged: true },
        events: {},
        extensions: {
          "io.modelcontextprotocol/skills": {},
        },
      } as any,
    }
  );

  const workspaceId = principal.workspaceId;
  const actor = {
    id: principal.clientId,
    name: "AI Assistant (MCP)",
    type: "AI_AGENT" as const,
  };

  // Helper to assert scope
  function requireScope(scope: McpScope) {
    if (!hasMcpScope(principal.scopes, scope)) {
      throw new Error(`FORBIDDEN: Missing required OAuth scope '${scope}'`);
    }
  }

  // --- UI RESOURCES (MCP Apps Standard & ChatGPT UI Extension) ---

  server.registerResource(
    "dashboard_widget",
    DASHBOARD_WIDGET_URI,
    {
      mimeType: "text/html;profile=mcp-app",
      description: "Interactive Executive Dashboard Widget UI for Apex Commerce",
    },
    async () => ({
      contents: [
        {
          uri: DASHBOARD_WIDGET_URI,
          mimeType: "text/html;profile=mcp-app",
          text: getDashboardWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
            },
          },
        },
      ],
    })
  );

  server.registerResource(
    "products_widget",
    PRODUCTS_WIDGET_URI,
    {
      mimeType: "text/html;profile=mcp-app",
      description: "Interactive Products & Inventory Catalog Widget UI",
    },
    async () => ({
      contents: [
        {
          uri: PRODUCTS_WIDGET_URI,
          mimeType: "text/html;profile=mcp-app",
          text: getProductsWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
            },
          },
        },
      ],
    })
  );

  server.registerResource(
    "order_widget",
    ORDER_WIDGET_URI,
    {
      mimeType: "text/html;profile=mcp-app",
      description: "Interactive Order Inspector & Action Widget UI",
    },
    async () => ({
      contents: [
        {
          uri: ORDER_WIDGET_URI,
          mimeType: "text/html;profile=mcp-app",
          text: getOrderWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
            },
          },
        },
      ],
    })
  );

  // --- 0. OPENAI PROFILE & COMPANY KNOWLEDGE COMPATIBILITY TOOLS ---

  server.registerTool(
    "get_user_profile",
    {
      title: "Get User Profile",
      description:
        "Retrieve authenticated operator identity, active role, permissions, and multi-tenant workspace context.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        "openai/profile": true,
      },
    },
    async () => {
      const db = await getDb();
      const [ws] = await (db as any)
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      const profile = {
        userId: principal.clientId,
        name: principal.clientId === "client_owner_local" ? "Rohan Sharma" : "Operator",
        workspaceId: principal.workspaceId,
        workspaceName: ws?.name || "Apex Logistics & Retail",
        role: principal.scopes.includes("orders:write") ? "ADMIN" : "OPERATOR",
        scopes: principal.scopes,
      };

      return {
        content: [
          {
            type: "text",
            text: `Authenticated as ${profile.name} (${profile.role}) in workspace "${profile.workspaceName}" (${profile.workspaceId}).`,
          },
        ],
        structuredContent: profile,
        _meta: {
          "openai/profile": true,
        },
      };
    }
  );

  server.registerTool(
    "search",
    {
      title: "Search Knowledge & Records",
      description:
        "Standard company knowledge search across products, customer accounts, and order records. Returns absolute URLs for citations.",
      inputSchema: {
        query: z.string().describe("Search keyword query"),
        limit: z.coerce.number().optional().default(10),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ query, limit }) => {
      requireScope("dashboard:read");
      const baseUrl = getBaseUrl();
      const prods = await productService.listProducts(workspaceId, { search: query });
      const ords = await orderService.listOrders(workspaceId, { search: query });
      const custs = await customerService.listCustomers(workspaceId, query);

      const results = [
        ...prods.map((p: any) => ({
          id: `product:${p.id}`,
          title: `${p.name} (SKU: ${p.sku})`,
          text: `Product: ${p.name}, SKU: ${p.sku}, Price: ₹${p.sellingPrice || p.price}, Physical: ${p.physicalStock}, Available: ${p.availableStock}`,
          url: `${baseUrl}/products#${p.id}`,
        })),
        ...ords.map((o: any) => ({
          id: `order:${o.id}`,
          title: `Order ${o.orderNumber}`,
          text: `Order ${o.orderNumber}, Status: ${o.status}, Total: ₹${o.totalAmount}, Payment: ${o.paymentStatus}`,
          url: `${baseUrl}/orders#${o.id}`,
        })),
        ...custs.map((c: any) => ({
          id: `customer:${c.id}`,
          title: `Customer: ${c.name}`,
          text: `Customer ${c.name}, Email: ${c.email || "N/A"}, Phone: ${c.phone || "N/A"}`,
          url: `${baseUrl}/customers#${c.id}`,
        })),
      ].slice(0, limit);

      return {
        content: [{ type: "text", text: `Found ${results.length} records matching "${query}".` }],
        structuredContent: { results },
      };
    }
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch Knowledge Record",
      description:
        "Fetch a specific business entity by its identifier (e.g. product:prod_xxx, order:ord_xxx, or customer:cust_xxx) with citation URL.",
      inputSchema: {
        id: z.string().describe("Entity identifier with type prefix (e.g. product:id, order:id, customer:id)"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ id }) => {
      requireScope("dashboard:read");
      const baseUrl = getBaseUrl();
      const [type, rawId] = id.includes(":") ? id.split(":") : ["product", id];

      if (type === "order") {
        const order = await orderService.getOrderDetails(workspaceId, rawId);
        if (!order) throw new Error(`Order not found: ${rawId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
          structuredContent: {
            id,
            title: `Order ${order.orderNumber}`,
            text: `Order ${order.orderNumber} in status ${order.status} with ${order.items?.length || 0} line items.`,
            url: `${baseUrl}/orders#${rawId}`,
            metadata: order,
          },
        };
      } else if (type === "customer") {
        const customer = await customerService.getCustomer(workspaceId, rawId);
        if (!customer) throw new Error(`Customer not found: ${rawId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(customer, null, 2) }],
          structuredContent: {
            id,
            title: `Customer ${customer.name}`,
            text: `Customer ${customer.name}, Phone: ${customer.phone}, Address: ${customer.defaultShippingAddress}`,
            url: `${baseUrl}/customers#${rawId}`,
            metadata: customer,
          },
        };
      } else {
        const prods = await productService.listProducts(workspaceId);
        const product = prods.find(
          (p: any) => p.id === rawId || p.sku.toUpperCase() === rawId.toUpperCase()
        );
        if (!product) throw new Error(`Product not found: ${rawId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(product, null, 2) }],
          structuredContent: {
            id,
            title: `Product ${product.name}`,
            text: `Product ${product.name} (SKU: ${product.sku}), Price: ₹${product.sellingPrice || product.price}, Available: ${product.availableStock}`,
            url: `${baseUrl}/products#${rawId}`,
            metadata: product,
          },
        };
      }
    }
  );

  // --- 1. DASHBOARD & SEARCH TOOLS ---

  server.tool(
    "get_dashboard_summary",
    "Retrieve high-level business overview including product counts, orders to pack/ship, revenue and inventory valuation",
    {},
    async () => {
      requireScope("dashboard:read");
      const summary = await reportService.getDashboardOverview(workspaceId);
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary,
      };
    }
  );

  server.tool(
    "get_business_overview",
    "Get full business summary including outstanding payment balances, unfulfilled orders, and low-stock count",
    {},
    async () => {
      requireScope("dashboard:read");
      const summary = await reportService.getDashboardOverview(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "search_business_records",
    "Global search across products, orders, and customers by query keyword",
    { query: z.string().min(1, "Search keyword is required") },
    async ({ query }) => {
      requireScope("dashboard:read");
      const prods = await productService.listProducts(workspaceId, { search: query });
      const ords = await orderService.listOrders(workspaceId, { search: query });
      const custs = await customerService.listCustomers(workspaceId, query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ products: prods, orders: ords, customers: custs }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_recent_activity",
    "Get recent audit logs and state changes made by humans or AI assistants",
    { limit: z.coerce.number().optional().default(20) },
    async ({ limit }) => {
      requireScope("audit:read");
      const db = await getDb();
      const events = await (db as any)
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.workspaceId, workspaceId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit);
      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
    }
  );

  server.tool(
    "get_low_stock_products",
    "List all products whose available stock is less than or equal to their reorder threshold",
    {},
    async () => {
      requireScope("inventory:read");
      const prods = await productService.listProducts(workspaceId, { lowStockOnly: true });
      return { content: [{ type: "text", text: JSON.stringify(prods, null, 2) }] };
    }
  );

  server.tool(
    "get_out_of_stock_products",
    "List all products whose available stock is zero or depleted",
    {},
    async () => {
      requireScope("inventory:read");
      const prods = await productService.listProducts(workspaceId);
      const outOfStock = prods.filter((p: any) => p.availableStock <= 0);
      return { content: [{ type: "text", text: JSON.stringify(outOfStock, null, 2) }] };
    }
  );

  // --- 2. PRODUCT TOOLS ---

  server.tool(
    "list_products",
    "List products with optional category, low-stock filter, and search query",
    {
      categoryId: z.string().optional(),
      lowStockOnly: z.boolean().optional(),
      search: z.string().optional(),
    },
    async (args) => {
      requireScope("products:read");
      const prods = await productService.listProducts(workspaceId, args);
      return {
        content: [{ type: "text", text: JSON.stringify(prods, null, 2) }],
        structuredContent: { products: prods },
      };
    }
  );

  server.tool(
    "search_products",
    "Search products by name, SKU, or barcode",
    { query: z.string() },
    async ({ query }) => {
      requireScope("products:read");
      const prods = await productService.listProducts(workspaceId, { search: query });
      return { content: [{ type: "text", text: JSON.stringify(prods, null, 2) }] };
    }
  );

  server.tool(
    "get_product",
    "Get detailed product info including physical, reserved, and available stock by ID or SKU",
    { productIdOrSku: z.string() },
    async ({ productIdOrSku }) => {
      requireScope("products:read");
      const prods = await productService.listProducts(workspaceId);
      const prod = prods.find(
        (p: any) =>
          p.id === productIdOrSku || p.sku.toUpperCase() === productIdOrSku.toUpperCase()
      );
      if (!prod) throw new Error(`Product not found: ${productIdOrSku}`);
      return { content: [{ type: "text", text: JSON.stringify(prod, null, 2) }] };
    }
  );

  server.tool(
    "create_product",
    "Create a new product record in the catalog",
    {
      name: z.string().min(2),
      sku: z.string().min(2),
      purchaseCost: z.coerce.number().min(0),
      sellingPrice: z.coerce.number().min(0),
      initialStock: z.coerce.number().int().min(0).default(0),
      reorderThreshold: z.coerce.number().int().min(0).default(10),
      categoryId: z.string().optional(),
      description: z.string().optional(),
      barcode: z.string().optional(),
    },
    async (args) => {
      requireScope("products:write");
      const result = await productService.createProduct({
        ...args,
        workspaceId,
        actor,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_product",
    "Update an existing product's price, name, or metadata",
    {
      productId: z.string(),
      name: z.string().optional(),
      sellingPrice: z.coerce.number().optional(),
      purchaseCost: z.coerce.number().optional(),
      reorderThreshold: z.coerce.number().int().optional(),
      description: z.string().optional(),
    },
    async (args) => {
      requireScope("products:write");
      const result = await productService.updateProduct({
        ...args,
        workspaceId,
        actor,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "archive_product",
    "Archive a product to hide it from active catalogs",
    { productId: z.string() },
    async ({ productId }) => {
      requireScope("products:write");
      const result = await productService.updateProduct({
        productId,
        isActive: false,
        workspaceId,
        actor,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "list_categories",
    {
      title: "List Categories",
      description: "List all product categories in the workspace, including product counts, descriptions, and active status.",
      inputSchema: {
        activeOnly: z.boolean().optional().default(false).describe("If true, filters to only active categories"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ activeOnly }) => {
      requireScope("products:read");
      const cats = await productService.listCategories(workspaceId, { activeOnly });
      return {
        content: [{ type: "text", text: JSON.stringify(cats, null, 2) }],
        structuredContent: { categories: cats },
      };
    }
  );

  server.registerTool(
    "create_category",
    {
      title: "Create Category",
      description: "Create a new product category in the workspace. Prevents duplicate category names.",
      inputSchema: {
        name: z.string().min(2).describe("Category name (e.g. 'Skin Care', 'Hair Care')"),
        description: z.string().optional().describe("Description of what belongs in this category"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      requireScope("products:write");
      const cat = await productService.createCategory({ ...args, workspaceId });
      return {
        content: [{ type: "text", text: JSON.stringify(cat, null, 2) }],
        structuredContent: cat,
      };
    }
  );

  server.registerTool(
    "create_category_if_missing",
    {
      title: "Create Category If Missing",
      description: "Idempotently create a product category if one with the same normalized name does not already exist. Prevents accidental duplicate categories.",
      inputSchema: {
        name: z.string().min(2).describe("Category name (e.g. 'Eye Care', 'Skin Care')"),
        description: z.string().optional().describe("Category description"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, description }) => {
      requireScope("products:write");
      const result = await productService.createCategoryIfMissing({
        workspaceId,
        name,
        description,
        actor,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "update_category",
    {
      title: "Update Category",
      description: "Update an existing category's name, description, or active status.",
      inputSchema: {
        categoryId: z.string().describe("The category ID to update (e.g. cat_...)"),
        name: z.string().min(2).optional().describe("New category name"),
        description: z.string().optional().describe("New description"),
        isActive: z.boolean().optional().describe("Active status flag"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ categoryId, name, description, isActive }) => {
      requireScope("products:write");
      const result = await productService.updateCategory({
        workspaceId,
        categoryId,
        name,
        description,
        isActive,
        actor,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "get_product_category",
    {
      title: "Get Product Category",
      description: "Retrieve a product's current category details (name, ID, active status) by product ID or SKU. Clarifies if product is uncategorized.",
      inputSchema: {
        productIdOrSku: z.string().describe("Product ID (e.g. prd_...) or SKU (e.g. MAKA-SC-001)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ productIdOrSku }) => {
      requireScope("products:read");
      const result = await productService.getProductCategory({
        workspaceId,
        productIdOrSku,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "update_product_category",
    {
      title: "Update Product Category",
      description: "Assign an existing product to an existing category by product ID or SKU. Preserves all other product attributes, prices, stock, and barcodes.",
      inputSchema: {
        productIdOrSku: z.string().describe("The product ID (e.g. prd_...) or SKU (e.g. MAKA-SC-001)"),
        categoryId: z.string().describe("The target category ID (e.g. cat_...) to assign"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ productIdOrSku, categoryId }) => {
      requireScope("products:write");
      const result = await productService.updateProductCategory({
        workspaceId,
        productIdOrSku,
        categoryId,
        actor,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "bulk_update_product_categories",
    {
      title: "Bulk Update Product Categories",
      description: "Assign categories to multiple products in a single operation. Defaults to dry-run mode (dryRun: true) to preview valid and invalid assignments before applying changes.",
      inputSchema: {
        items: z.array(
          z.object({
            productIdOrSku: z.string().describe("Product ID or SKU"),
            categoryId: z.string().describe("Target category ID"),
          })
        ).min(1).describe("List of product and category assignments to process"),
        dryRun: z.boolean().optional().default(true).describe("If true (default), validates all assignments without writing changes. Set false to execute updates."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ items, dryRun }) => {
      requireScope("products:write");
      const result = await productService.bulkUpdateProductCategories({
        workspaceId,
        items,
        dryRun,
        actor,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "suggest_product_category",
    {
      title: "Suggest Product Category",
      description: "Recommend a suitable existing category for a product based on its name, description, and catalog taxonomy. Does not modify the product. If no match is found, recommends creating a new category.",
      inputSchema: {
        productIdOrSku: z.string().optional().describe("Product ID or SKU to inspect"),
        name: z.string().optional().describe("Product name to evaluate if not using existing product"),
        description: z.string().optional().describe("Product description to evaluate"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      requireScope("products:read");
      const result = await productService.suggestProductCategory({
        workspaceId,
        ...args,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  // --- 3. INVENTORY TOOLS ---

  server.tool(
    "get_inventory_summary",
    "Get full inventory summary with physical stock, reserved stock, available stock, and valuation",
    {},
    async () => {
      requireScope("inventory:read");
      const summary = await inventoryService.getInventorySummary(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "get_product_stock",
    "Get physical, reserved, and available stock for a specific product by SKU or ID",
    { productIdOrSku: z.string() },
    async ({ productIdOrSku }) => {
      requireScope("inventory:read");
      const prods = await productService.listProducts(workspaceId);
      const prod = prods.find(
        (p: any) => p.id === productIdOrSku || p.sku.toUpperCase() === productIdOrSku.toUpperCase()
      );
      if (!prod) throw new Error(`Product not found: ${productIdOrSku}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: prod.id,
                sku: prod.sku,
                name: prod.name,
                physicalStock: prod.physicalStock,
                reservedStock: prod.reservedStock,
                availableStock: prod.availableStock,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "get_available_stock",
    "Get available stock for a product (Available = Physical - Reserved)",
    { productIdOrSku: z.string() },
    async ({ productIdOrSku }) => {
      requireScope("inventory:read");
      const prods = await productService.listProducts(workspaceId);
      const prod = prods.find(
        (p: any) => p.id === productIdOrSku || p.sku.toUpperCase() === productIdOrSku.toUpperCase()
      );
      if (!prod) throw new Error(`Product not found: ${productIdOrSku}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { sku: prod.sku, availableStock: prod.availableStock, physical: prod.physicalStock, reserved: prod.reservedStock },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "get_reserved_stock",
    "Get currently reserved stock for a product pending fulfillment",
    { productIdOrSku: z.string() },
    async ({ productIdOrSku }) => {
      requireScope("inventory:read");
      const prods = await productService.listProducts(workspaceId);
      const prod = prods.find(
        (p: any) => p.id === productIdOrSku || p.sku.toUpperCase() === productIdOrSku.toUpperCase()
      );
      if (!prod) throw new Error(`Product not found: ${productIdOrSku}`);
      return { content: [{ type: "text", text: JSON.stringify({ sku: prod.sku, reservedStock: prod.reservedStock }, null, 2) }] };
    }
  );

  server.tool(
    "list_inventory_transactions",
    "List inventory ledger transactions (stock intake, reservations, dispatches, adjustments)",
    { limit: z.coerce.number().optional().default(50) },
    async ({ limit }) => {
      requireScope("inventory:read");
      const txs = await inventoryService.listInventoryTransactions(workspaceId, limit);
      return { content: [{ type: "text", text: JSON.stringify(txs, null, 2) }] };
    }
  );

  server.tool(
    "adjust_inventory",
    "Manually adjust physical stock with mandatory reason and ledger entry (High-impact write)",
    {
      productId: z.string(),
      quantityChange: z.coerce.number().int(),
      reason: z.string().min(3, "Reason is required"),
      confirmationToken: z.string().optional(),
    },
    async ({ productId, quantityChange, reason, confirmationToken }) => {
      requireScope("inventory:write");
      // High impact check: if confirmationToken not supplied, require confirmation
      if (!confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "adjust_inventory",
          parameters: { productId, quantityChange, reason },
          riskLevel: "HIGH",
          description: `Adjust physical stock by ${quantityChange > 0 ? "+" : ""}${quantityChange} units for product ${productId}. Reason: ${reason}`,
        });
        return { content: [{ type: "text", text: JSON.stringify(conf, null, 2) }] };
      }

      await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "adjust_inventory");
      const result = await inventoryService.adjustInventory({
        workspaceId,
        productId,
        quantityChange,
        reason,
        actor,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "receive_inventory",
    "Receive new inventory shipment from supplier into warehouse",
    {
      productId: z.string(),
      quantity: z.coerce.number().int().positive(),
      supplierReference: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ productId, quantity, supplierReference, notes }) => {
      requireScope("inventory:write");
      const reason = `Stock intake ${supplierReference ? `(Ref: ${supplierReference})` : ""}${notes ? `: ${notes}` : ""}`.trim();
      const result = await inventoryService.adjustInventory({
        workspaceId,
        productId,
        quantityChange: quantity,
        reason: reason || "Supplier intake",
        type: "STOCK_RECEIVED",
        actor,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_low_stock_report",
    "Get detailed analysis of all products below reorder thresholds",
    {},
    async () => {
      requireScope("inventory:read");
      const prods = await productService.listProducts(workspaceId, { lowStockOnly: true });
      return { content: [{ type: "text", text: JSON.stringify(prods, null, 2) }] };
    }
  );

  server.tool(
    "get_inventory_valuation",
    "Calculate total financial valuation of inventory based on purchase costs and selling prices",
    {},
    async () => {
      requireScope("inventory:read");
      const summary = await inventoryService.getInventorySummary(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify({ valuation: summary.totalValuation, totalUnits: summary.totalPhysicalStock }, null, 2) }] };
    }
  );

  // --- 4. CUSTOMER TOOLS ---

  server.tool(
    "list_customers",
    "List customers with optional search",
    { search: z.string().optional() },
    async ({ search }) => {
      requireScope("customers:read");
      const custs = await customerService.listCustomers(workspaceId, search);
      return { content: [{ type: "text", text: JSON.stringify(custs, null, 2) }] };
    }
  );

  server.tool(
    "search_customers",
    "Search customers by name, phone, or email",
    { query: z.string() },
    async ({ query }) => {
      requireScope("customers:read");
      const custs = await customerService.listCustomers(workspaceId, query);
      return { content: [{ type: "text", text: JSON.stringify(custs, null, 2) }] };
    }
  );

  server.tool(
    "get_customer",
    "Get customer details and order history by ID",
    { customerId: z.string() },
    async ({ customerId }) => {
      requireScope("customers:read");
      const cust = await customerService.getCustomer(workspaceId, customerId);
      if (!cust) throw new Error(`Customer not found: ${customerId}`);
      return { content: [{ type: "text", text: JSON.stringify(cust, null, 2) }] };
    }
  );

  server.tool(
    "create_customer",
    "Create a new customer profile",
    {
      name: z.string().min(2),
      shippingAddress: z.string().min(5),
      phone: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      requireScope("customers:write");
      const cust = await customerService.createCustomer({ ...args, workspaceId, actor });
      return { content: [{ type: "text", text: JSON.stringify(cust, null, 2) }] };
    }
  );

  server.tool(
    "update_customer",
    "Update customer contact or shipping address",
    {
      customerId: z.string(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      shippingAddress: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      requireScope("customers:write");
      const result = await customerService.updateCustomer({ ...args, workspaceId, actor });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_customer_order_history",
    "Get all past orders placed by a specific customer",
    { customerId: z.string() },
    async ({ customerId }) => {
      requireScope("customers:read");
      const cust = await customerService.getCustomer(workspaceId, customerId);
      if (!cust) throw new Error(`Customer not found: ${customerId}`);
      return { content: [{ type: "text", text: JSON.stringify(cust.orders, null, 2) }] };
    }
  );

  // --- 5. ORDER TOOLS ---

  server.tool(
    "list_orders",
    "List orders with optional status, payment status, and search filters",
    {
      status: z.string().optional(),
      paymentStatus: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().optional().default(50),
    },
    async (args) => {
      requireScope("orders:read");
      const ords = await orderService.listOrders(workspaceId, args);
      return { content: [{ type: "text", text: JSON.stringify(ords, null, 2) }] };
    }
  );

  server.tool(
    "search_orders",
    "Search orders by order number or customer name",
    { query: z.string() },
    async ({ query }) => {
      requireScope("orders:read");
      const ords = await orderService.listOrders(workspaceId, { search: query });
      return { content: [{ type: "text", text: JSON.stringify(ords, null, 2) }] };
    }
  );

  server.tool(
    "get_order",
    "Get complete order details including items, history, and customer info by order number or ID",
    { orderIdOrNumber: z.string() },
    async ({ orderIdOrNumber }) => {
      requireScope("orders:read");
      const ord = await orderService.getOrderDetails(workspaceId, orderIdOrNumber);
      if (!ord) throw new Error(`Order not found: ${orderIdOrNumber}`);
      return {
        content: [{ type: "text", text: JSON.stringify(ord, null, 2) }],
        structuredContent: ord,
      };
    }
  );

  server.registerTool(
    "create_order",
    {
      title: "Create Customer Order",
      description:
        "Create a verified customer order, reserve available catalog stock, and calculate order totals against the current inventory ledger.",
      inputSchema: {
        customerId: z
          .string()
          .optional()
          .describe(
            "Existing customer ID (e.g. cust_xxx). If provided, shippingAddress can be omitted to use customer's address on file."
          ),
        newCustomerName: z
          .string()
          .optional()
          .describe("Customer full name if creating a new customer."),
        newCustomerPhone: z
          .string()
          .optional()
          .describe("Customer phone number if creating a new customer."),
        newCustomerEmail: z
          .string()
          .optional()
          .describe("Customer email address if creating a new customer."),
        shippingAddress: z
          .string()
          .optional()
          .describe(
            "Shipping delivery address. Required for new customers; optional if customerId is provided and address is on file."
          ),
        source: z
          .string()
          .optional()
          .default("WhatsApp")
          .describe("Order intake channel (WhatsApp, Phone, Instagram, Website, etc.)."),
        items: z
          .array(
            z.object({
              productId: z.string().describe("Product ID from catalog (e.g. prd_xxx)."),
              quantity: z.coerce.number().int().positive().describe("Quantity of items (positive integer)."),
              unitPrice: z.coerce.number().positive().optional().describe("Expected unit price. Verified against catalog price."),
              discount: z.coerce.number().min(0).optional().describe("Discount amount on this item line."),
            })
          )
          .min(1)
          .describe("List of items to order. Stock will be automatically reserved."),
        orderDiscount: z
          .coerce.number()
          .min(0)
          .optional()
          .default(0)
          .describe("Overall order discount."),
        shippingFee: z
          .coerce.number()
          .min(0)
          .optional()
          .default(0)
          .describe("Shipping delivery charge."),
        paymentMethod: z
          .string()
          .optional()
          .default("Cash on Delivery")
          .describe("Payment channel: UPI, Cash on Delivery, Card, Net Banking, etc."),
        paymentStatus: z
          .enum(["UNPAID", "PARTIALLY_PAID", "PAID"])
          .optional()
          .default("UNPAID")
          .describe("Payment status: UNPAID, PARTIALLY_PAID, or PAID."),
        paymentReference: z
          .string()
          .optional()
          .describe(
            "Payment transaction reference (e.g. UPI transaction ID, bank UTR) required to mark order as verified PAID."
          ),
        paymentReportedByCustomer: z
          .boolean()
          .optional()
          .describe(
            "Set to true if customer reports they have paid (e.g. via UPI) but merchant has not yet independently verified the transaction."
          ),
        packingNotes: z
          .string()
          .optional()
          .describe("Instructions for warehouse packing team."),
        notes: z
          .string()
          .optional()
          .describe("Internal order notes or customer requests."),
        idempotencyKey: z
          .string()
          .optional()
          .describe("Unique client-generated idempotency key to prevent duplicate orders on network retries."),
        confirmed: z
          .boolean()
          .optional()
          .default(true)
          .describe("Explicit confirmation to place order and reserve inventory."),
        confirmationToken: z
          .string()
          .optional()
          .describe("Approval token from pending confirmations workflow if required."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      requireScope("orders:create");
      const {
        customerId,
        newCustomerName,
        newCustomerPhone,
        newCustomerEmail,
        shippingAddress,
        source,
        items,
        orderDiscount,
        shippingFee,
        paymentMethod,
        paymentStatus,
        paymentReference,
        paymentReportedByCustomer,
        packingNotes,
        notes,
        idempotencyKey,
        confirmed,
        confirmationToken,
      } = args;

      // Handle confirmation workflows
      if (confirmationToken) {
        await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "create_order");
      } else if (confirmed === false) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "create_order",
          parameters: args,
          riskLevel: "HIGH",
          description: `Create order with ${items.length} item(s) reserving warehouse inventory. Delivery to: ${shippingAddress || "Customer address on file"}`,
        });
        return {
          content: [
            {
              type: "text",
              text: `⚠️ Operator confirmation required to reserve stock and create order. Call create_order with confirmed: true or use confirmation token: ${conf.confirmationToken}`,
            },
          ],
          structuredContent: {
            code: "CONFIRMATION_REQUIRED",
            confirmation: conf,
          },
        };
      }

      const newCustomer = newCustomerName
        ? {
            name: newCustomerName,
            phone: newCustomerPhone || null,
            email: newCustomerEmail || null,
            shippingAddress: shippingAddress || "",
          }
        : null;

      try {
        const order = await orderService.createOrder({
          workspaceId,
          customerId: customerId || null,
          newCustomer,
          shippingAddress: shippingAddress || null,
          source,
          items,
          orderDiscount,
          shippingFee,
          paymentMethod,
          paymentStatus,
          paymentReference,
          paymentReportedByCustomer,
          packingNotes,
          notes,
          idempotencyKey,
          confirmed,
          actor,
          sourceType: "mcp",
        });

        return {
          content: [
            {
              type: "text",
              text: `✓ Order ${order.orderNumber} successfully created (Total: ₹${order.totalAmount}, Status: ${order.status}, Payment: ${order.paymentStatus}). Inventory reserved for ${order.items.length} item(s).`,
            },
          ],
          structuredContent: {
            success: true,
            order,
          },
        };
      } catch (err: any) {
        const errorCode = err instanceof orderService.OrderServiceError ? err.code : "INTERNAL_ERROR";
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `⚠️ Order creation failed [${errorCode}]: ${err.message}`,
            },
          ],
          structuredContent: {
            success: false,
            code: errorCode,
            message: err.message,
            details: err instanceof orderService.OrderServiceError ? err.details : undefined,
          },
        };
      }
    }
  );

  server.tool(
    "update_order",
    "Update order notes or shipping address",
    {
      orderId: z.string(),
      notes: z.string().optional(),
      packingNotes: z.string().optional(),
    },
    async ({ orderId, notes, packingNotes }) => {
      requireScope("orders:update");
      const db = await getDb();
      const updates: any = { updatedAt: new Date() };
      if (notes !== undefined) updates.notes = notes;
      if (packingNotes !== undefined) updates.packingNotes = packingNotes;
      await (db as any).update(orders).set(updates).where(eq(orders.id, orderId));
      return { content: [{ type: "text", text: JSON.stringify({ success: true, orderId }, null, 2) }] };
    }
  );

  server.tool(
    "get_order_items",
    "Get all line items for an order with SKU, name, quantity, and unit prices",
    { orderId: z.string() },
    async ({ orderId }) => {
      requireScope("orders:read");
      const ord = await orderService.getOrderDetails(workspaceId, orderId);
      if (!ord) throw new Error(`Order not found: ${orderId}`);
      return { content: [{ type: "text", text: JSON.stringify(ord.items, null, 2) }] };
    }
  );

  server.tool(
    "get_order_history",
    "Get chronological status changes and audit log for an order",
    { orderId: z.string() },
    async ({ orderId }) => {
      requireScope("orders:read");
      const ord = await orderService.getOrderDetails(workspaceId, orderId);
      if (!ord) throw new Error(`Order not found: ${orderId}`);
      return { content: [{ type: "text", text: JSON.stringify(ord.history, null, 2) }] };
    }
  );

  server.tool(
    "add_order_note",
    "Append internal note to an order record",
    { orderId: z.string(), note: z.string().min(1) },
    async ({ orderId, note }) => {
      requireScope("orders:update");
      const ord = await orderService.getOrderDetails(workspaceId, orderId);
      if (!ord) throw new Error(`Order not found: ${orderId}`);
      const updatedNotes = ord.notes ? `${ord.notes}\n[AI Note]: ${note}` : `[AI Note]: ${note}`;
      const db = await getDb();
      await (db as any).update(orders).set({ notes: updatedNotes }).where(eq(orders.id, orderId));
      return { content: [{ type: "text", text: JSON.stringify({ success: true, orderId, notes: updatedNotes }, null, 2) }] };
    }
  );

  server.tool(
    "confirm_order",
    "Confirm a new order to proceed to warehouse packing",
    { orderId: z.string(), note: z.string().optional() },
    async ({ orderId, note }) => {
      requireScope("orders:update");
      const result = await orderService.updateOrderStatus({
        workspaceId,
        orderId,
        newStatus: "CONFIRMED",
        note,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "process_order",
    "Move order status to PROCESSING in warehouse",
    { orderId: z.string(), note: z.string().optional() },
    async ({ orderId, note }) => {
      requireScope("orders:update");
      const result = await orderService.updateOrderStatus({
        workspaceId,
        orderId,
        newStatus: "PROCESSING",
        note,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "cancel_order",
    "Cancel an order and release reserved inventory back to warehouse available stock (High-impact write)",
    {
      orderId: z.string(),
      reason: z.string().min(3),
      confirmationToken: z.string().optional(),
    },
    async ({ orderId, reason, confirmationToken }) => {
      requireScope("orders:cancel");
      if (!confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "cancel_order",
          parameters: { orderId, reason },
          riskLevel: "HIGH",
          description: `Cancel order ${orderId} and release all reserved stock. Reason: ${reason}`,
        });
        return { content: [{ type: "text", text: JSON.stringify(conf, null, 2) }] };
      }

      await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "cancel_order");
      const result = await orderService.updateOrderStatus({
        workspaceId,
        orderId,
        newStatus: "CANCELLED",
        note: `Cancelled: ${reason}`,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- 6. PACKING TOOLS ---

  server.tool(
    "list_orders_to_pack",
    "List all orders ready in the packing queue (CONFIRMED or PROCESSING status)",
    {},
    async () => {
      requireScope("packing:read");
      const queue = await packingService.listOrdersToPack(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(queue, null, 2) }] };
    }
  );

  server.tool(
    "get_packing_queue",
    "Retrieve packing queue summary and order count waiting for packing",
    {},
    async () => {
      requireScope("packing:read");
      const queue = await packingService.listOrdersToPack(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify({ count: queue.length, orders: queue }, null, 2) }] };
    }
  );

  server.tool(
    "get_packing_details",
    "Get detailed packing requirements and line items for an order",
    { orderId: z.string() },
    async ({ orderId }) => {
      requireScope("packing:read");
      const slip = await packingService.getPackingSlip(workspaceId, orderId);
      return { content: [{ type: "text", text: JSON.stringify(slip, null, 2) }] };
    }
  );

  server.tool(
    "get_packing_slip",
    "Generate printable packing slip data for warehouse personnel (excluding sensitive payment data)",
    { orderIdOrNumber: z.string() },
    async ({ orderIdOrNumber }) => {
      requireScope("packing:read");
      const slip = await packingService.getPackingSlip(workspaceId, orderIdOrNumber);
      return { content: [{ type: "text", text: JSON.stringify(slip, null, 2) }] };
    }
  );

  server.tool(
    "mark_order_packed",
    "Mark an order as PACKED and ready for shipping dispatch",
    {
      orderId: z.string(),
      packingNotes: z.string().optional(),
    },
    async (args) => {
      requireScope("packing:write");
      const result = await packingService.markOrderPacked({
        ...args,
        workspaceId,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- 7. SHIPPING TOOLS ---

  server.tool(
    "list_orders_to_ship",
    "List all PACKED orders waiting for shipping dispatch",
    {},
    async () => {
      requireScope("shipping:read");
      const queue = await shippingService.listOrdersToShip(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(queue, null, 2) }] };
    }
  );

  server.tool(
    "get_shipping_queue",
    "Get summary of orders ready to ship",
    {},
    async () => {
      requireScope("shipping:read");
      const queue = await shippingService.listOrdersToShip(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify({ count: queue.length, orders: queue }, null, 2) }] };
    }
  );

  server.tool(
    "get_shipped_orders",
    "List currently dispatched and in-transit orders",
    {},
    async () => {
      requireScope("shipping:read");
      const ords = await orderService.listOrders(workspaceId, { status: "SHIPPED" });
      return { content: [{ type: "text", text: JSON.stringify(ords, null, 2) }] };
    }
  );

  server.tool(
    "get_shipment_details",
    "Get courier tracking information and shipment timestamps for an order",
    { orderId: z.string() },
    async ({ orderId }) => {
      requireScope("shipping:read");
      const shipmentsList = await shippingService.listShipments(workspaceId);
      const shp = shipmentsList.find((s: any) => s.shipment.orderId === orderId);
      if (!shp) throw new Error(`No shipment found for order: ${orderId}`);
      return { content: [{ type: "text", text: JSON.stringify(shp, null, 2) }] };
    }
  );

  server.tool(
    "update_shipping_details",
    "Update courier tracking number or courier partner for an order",
    {
      orderId: z.string(),
      courier: z.string(),
      trackingNumber: z.string(),
    },
    async ({ orderId, courier, trackingNumber }) => {
      requireScope("shipping:write");
      const db = await getDb();
      await (db as any)
        .update(orders)
        .set({ updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      return { content: [{ type: "text", text: JSON.stringify({ success: true, orderId, courier, trackingNumber }, null, 2) }] };
    }
  );

  server.tool(
    "mark_order_shipped",
    "Mark order SHIPPED, deduct physical stock, release reservation atomically, and record courier tracking (High-impact write)",
    {
      orderId: z.string(),
      courier: z.string().min(2),
      trackingNumber: z.string().min(3),
      expectedDeliveryDays: z.coerce.number().optional().default(3),
      notes: z.string().optional(),
      confirmationToken: z.string().optional(),
    },
    async (args) => {
      requireScope("shipping:write");
      if (!args.confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "mark_order_shipped",
          parameters: args,
          riskLevel: "HIGH",
          description: `Ship order ${args.orderId} via ${args.courier} (Tracking: ${args.trackingNumber}). Physical warehouse stock will be permanently deducted.`,
        });
        return { content: [{ type: "text", text: JSON.stringify(conf, null, 2) }] };
      }

      await confirmationService.verifyAndConsumeConfirmation(workspaceId, args.confirmationToken, "mark_order_shipped");
      const result = await shippingService.markOrderShipped({
        ...args,
        workspaceId,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "mark_order_delivered",
    "Mark an order as DELIVERED to customer (Note: does not automatically mark order paid)",
    {
      orderId: z.string(),
      notes: z.string().optional(),
    },
    async (args) => {
      requireScope("shipping:write");
      const result = await shippingService.markOrderDelivered({
        ...args,
        workspaceId,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- 8. PAYMENT TOOLS ---

  server.tool(
    "list_payments",
    "List payment transactions recorded for the workspace",
    { limit: z.coerce.number().optional().default(50) },
    async ({ limit }) => {
      requireScope("payments:read");
      const pays = await paymentService.listPayments(workspaceId, limit);
      return { content: [{ type: "text", text: JSON.stringify(pays, null, 2) }] };
    }
  );

  server.tool(
    "get_order_payment_status",
    "Get payment breakdown, amount paid, and remaining balance for an order",
    { orderId: z.string() },
    async ({ orderId }) => {
      requireScope("payments:read");
      const ord = await orderService.getOrderDetails(workspaceId, orderId);
      if (!ord) throw new Error(`Order not found: ${orderId}`);
      const totalPaid = ord.payments.reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
      const remaining = Math.max(0, parseFloat(ord.totalAmount) - totalPaid);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                orderNumber: ord.orderNumber,
                orderTotal: ord.totalAmount,
                totalPaid: totalPaid.toFixed(2),
                remainingBalance: remaining.toFixed(2),
                paymentStatus: ord.paymentStatus,
                payments: ord.payments,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "record_payment",
    "Record payment received against an order (High-impact write)",
    {
      orderId: z.string(),
      amount: z.coerce.number().positive(),
      paymentMethod: z.enum(["Cash", "Cash on Delivery", "UPI", "Bank transfer", "Other"]),
      reference: z.string().optional(),
      notes: z.string().optional(),
      idempotencyKey: z.string().optional(),
      confirmationToken: z.string().optional(),
    },
    async (args) => {
      requireScope("payments:write");
      if (!args.confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "record_payment",
          parameters: args,
          riskLevel: "HIGH",
          description: `Record payment of ₹${args.amount.toFixed(2)} via ${args.paymentMethod} against order ${args.orderId}`,
        });
        return { content: [{ type: "text", text: JSON.stringify(conf, null, 2) }] };
      }

      await confirmationService.verifyAndConsumeConfirmation(workspaceId, args.confirmationToken, "record_payment");
      const result = await paymentService.recordPayment({
        ...args,
        workspaceId,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_unpaid_orders",
    "List all orders with UNPAID payment status",
    {},
    async () => {
      requireScope("payments:read");
      const ords = await orderService.listOrders(workspaceId, { paymentStatus: "UNPAID" });
      return { content: [{ type: "text", text: JSON.stringify(ords, null, 2) }] };
    }
  );

  server.tool(
    "get_partial_payment_orders",
    "List all orders with PARTIALLY_PAID payment status",
    {},
    async () => {
      requireScope("payments:read");
      const ords = await orderService.listOrders(workspaceId, { paymentStatus: "PARTIALLY_PAID" });
      return { content: [{ type: "text", text: JSON.stringify(ords, null, 2) }] };
    }
  );

  server.tool(
    "get_payment_summary",
    "Get total cash collected, gross order value, and outstanding balance",
    {},
    async () => {
      requireScope("payments:read");
      const summary = await paymentService.getPaymentSummary(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );

  // --- 9. RETURNS TOOLS ---

  server.tool(
    "list_returns",
    "List return requests for orders",
    {},
    async () => {
      requireScope("returns:read");
      const rets = await returnService.listReturns(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(rets, null, 2) }] };
    }
  );

  server.tool(
    "get_return_details",
    "Get return details and inspection items for a return",
    { returnId: z.string() },
    async ({ returnId }) => {
      requireScope("returns:read");
      const rets = await returnService.listReturns(workspaceId);
      const ret = rets.find((r: any) => r.returnRecord.id === returnId);
      if (!ret) throw new Error(`Return not found: ${returnId}`);
      return { content: [{ type: "text", text: JSON.stringify(ret, null, 2) }] };
    }
  );

  server.tool(
    "register_return",
    "Register a return request for an order with return reason and items",
    {
      orderId: z.string(),
      reason: z.string().min(3),
      items: z.array(
        z.object({
          productId: z.string(),
          quantity: z.coerce.number().int().positive(),
          condition: z.enum(["sellable", "damaged"]).default("sellable"),
        })
      ),
      notes: z.string().optional(),
    },
    async (args) => {
      requireScope("returns:write");
      const result = await returnService.registerReturn({
        ...args,
        workspaceId,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "approve_return",
    "Approve a return, restock sellable items into warehouse inventory, and issue refund (High-impact write)",
    {
      returnId: z.string(),
      refundAmount: z.coerce.number().optional().default(0),
      restockSellable: z.boolean().optional().default(true),
      notes: z.string().optional(),
      confirmationToken: z.string().optional(),
    },
    async (args) => {
      requireScope("returns:write");
      if (!args.confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "approve_return",
          parameters: args,
          riskLevel: "HIGH",
          description: `Approve return ${args.returnId} with refund ₹${args.refundAmount.toFixed(2)}. Sellable items will be restocked to inventory.`,
        });
        return { content: [{ type: "text", text: JSON.stringify(conf, null, 2) }] };
      }

      await confirmationService.verifyAndConsumeConfirmation(workspaceId, args.confirmationToken, "approve_return");
      const result = await returnService.approveReturn({
        ...args,
        workspaceId,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "reject_return",
    "Reject a return request with explanation",
    { returnId: z.string(), reason: z.string().optional() },
    async (args) => {
      requireScope("returns:write");
      const result = await returnService.rejectReturn({
        ...args,
        workspaceId,
        actor,
        sourceType: "mcp",
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- 10. REPORTS TOOLS ---

  server.tool(
    "get_sales_report",
    "Get sales report by date range",
    { startDate: z.string().optional(), endDate: z.string().optional() },
    async (args) => {
      requireScope("reports:read");
      const report = await reportService.getSalesReport(workspaceId, args);
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }
  );

  server.tool(
    "get_order_report",
    "Get order count, status distribution, and fulfillment stats",
    {},
    async () => {
      requireScope("reports:read");
      const overview = await reportService.getDashboardOverview(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(overview.orders, null, 2) }] };
    }
  );

  server.tool(
    "get_inventory_report",
    "Get full inventory health, valuation, and stock counts",
    {},
    async () => {
      requireScope("reports:read");
      const summary = await inventoryService.getInventorySummary(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "get_product_performance",
    "Get top-selling products by quantity and revenue",
    { limit: z.coerce.number().optional().default(10) },
    async ({ limit }) => {
      requireScope("reports:read");
      const best = await reportService.getBestSellingProducts(workspaceId, limit);
      return { content: [{ type: "text", text: JSON.stringify(best, null, 2) }] };
    }
  );

  server.tool(
    "get_payment_report",
    "Get payment collections, method breakdown, and receivables",
    {},
    async () => {
      requireScope("reports:read");
      const summary = await paymentService.getPaymentSummary(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "get_cancellation_report",
    "Get cancelled orders and reasons",
    {},
    async () => {
      requireScope("reports:read");
      const ords = await orderService.listOrders(workspaceId, { status: "CANCELLED" });
      return { content: [{ type: "text", text: JSON.stringify({ count: ords.length, orders: ords }, null, 2) }] };
    }
  );

  server.tool(
    "get_return_report",
    "Get return volume, approved refunds, and damaged write-offs",
    {},
    async () => {
      requireScope("reports:read");
      const rets = await returnService.listReturns(workspaceId);
      return { content: [{ type: "text", text: JSON.stringify({ count: rets.length, returns: rets }, null, 2) }] };
    }
  );

  server.tool(
    "export_report_csv",
    "Export sales or product performance as CSV text",
    { reportType: z.enum(["sales", "products", "inventory"]) },
    async ({ reportType }) => {
      requireScope("reports:export");
      if (reportType === "products" || reportType === "inventory") {
        const prods = await productService.listProducts(workspaceId);
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
        return { content: [{ type: "text", text: csv }] };
      } else {
        const ords = await orderService.listOrders(workspaceId);
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
        return { content: [{ type: "text", text: csv }] };
      }
    }
  );

  // --- 10B. DESTRUCTIVE DELETION TOOLS (CHATGPT MCP COMPLIANCE) ---

  server.registerTool(
    "delete_product",
    {
      title: "Delete Product",
      description:
        "Permanently delete a product from the catalog. Destructive action requiring explicit confirmation. Unfulfilled orders reserving this product will block deletion unless force: true is specified.",
      inputSchema: {
        productIdOrSku: z.string().describe("The product ID or SKU to permanently delete"),
        confirmed: z.boolean().optional().default(false).describe("Explicit confirmation flag to execute deletion"),
        confirmationToken: z.string().optional().describe("Confirmation token if pre-authorized via confirmation flow"),
        force: z.boolean().optional().default(false).describe("Force deletion even if past non-active orders reference this product"),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ productIdOrSku, confirmed, confirmationToken, force }) => {
      requireScope("products:write");
      if (!confirmed && !confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "delete_product",
          parameters: { productIdOrSku, force },
          riskLevel: "HIGH",
          description: `Permanently delete product "${productIdOrSku}" from catalog.${force ? " (Force mode enabled)" : ""}`,
        });
        return {
          content: [
            {
              type: "text",
              text: `DESTRUCTIVE ACTION CONFIRMATION REQUIRED:\nPermanently deleting product "${productIdOrSku}". To proceed, call delete_product with confirmed: true or confirmationToken: "${conf.confirmationToken}".`,
            },
          ],
          structuredContent: conf,
        };
      }

      if (confirmationToken) {
        await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "delete_product");
      }

      const result = await productService.deleteProduct({
        workspaceId,
        productIdOrSku,
        actor,
        force,
      });

      return {
        content: [
          {
            type: "text",
            text: `Product ${result.name} (SKU: ${result.sku}, ID: ${result.deletedId}) was permanently deleted.`,
          },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "delete_order",
    {
      title: "Delete Order",
      description:
        "Permanently delete an order and automatically release any reserved warehouse inventory back to available stock. Destructive action requiring explicit confirmation.",
      inputSchema: {
        orderIdOrNumber: z.string().describe("The order ID (e.g. ord_...) or order number (e.g. ORD-1001) to permanently delete"),
        confirmed: z.boolean().optional().default(false).describe("Explicit confirmation flag to execute deletion"),
        confirmationToken: z.string().optional().describe("Confirmation token if pre-authorized via confirmation flow"),
        force: z.boolean().optional().default(false).describe("Force deletion if order is already marked SHIPPED or DELIVERED"),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ orderIdOrNumber, confirmed, confirmationToken, force }) => {
      requireScope("orders:cancel");
      if (!confirmed && !confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "delete_order",
          parameters: { orderIdOrNumber, force },
          riskLevel: "HIGH",
          description: `Permanently delete order "${orderIdOrNumber}" and release any reserved inventory back to available stock.`,
        });
        return {
          content: [
            {
              type: "text",
              text: `DESTRUCTIVE ACTION CONFIRMATION REQUIRED:\nPermanently deleting order "${orderIdOrNumber}". Any active inventory reservations will be automatically released. To proceed, call delete_order with confirmed: true or confirmationToken: "${conf.confirmationToken}".`,
            },
          ],
          structuredContent: conf,
        };
      }

      if (confirmationToken) {
        await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "delete_order");
      }

      const result = await orderService.deleteOrder({
        workspaceId,
        orderIdOrNumber,
        actor,
        force,
      });

      return {
        content: [
          {
            type: "text",
            text: `Order ${result.orderNumber} (ID: ${result.deletedId}) was permanently deleted and reserved stock was released.`,
          },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "delete_customer",
    {
      title: "Delete Customer",
      description:
        "Permanently delete a customer account. Blocked if customer has active unfulfilled orders unless force: true is specified. Destructive action requiring explicit confirmation.",
      inputSchema: {
        customerId: z.string().describe("The customer ID (e.g. cust_...) to permanently delete"),
        confirmed: z.boolean().optional().default(false).describe("Explicit confirmation flag to execute deletion"),
        confirmationToken: z.string().optional().describe("Confirmation token if pre-authorized via confirmation flow"),
        force: z.boolean().optional().default(false).describe("Force deletion and cascade delete customer's orders"),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ customerId, confirmed, confirmationToken, force }) => {
      requireScope("customers:write");
      if (!confirmed && !confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "delete_customer",
          parameters: { customerId, force },
          riskLevel: "HIGH",
          description: `Permanently delete customer record "${customerId}".${force ? " (Force mode enabled: cascades all customer orders)" : ""}`,
        });
        return {
          content: [
            {
              type: "text",
              text: `DESTRUCTIVE ACTION CONFIRMATION REQUIRED:\nPermanently deleting customer "${customerId}". To proceed, call delete_customer with confirmed: true or confirmationToken: "${conf.confirmationToken}".`,
            },
          ],
          structuredContent: conf,
        };
      }

      if (confirmationToken) {
        await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "delete_customer");
      }

      const result = await customerService.deleteCustomer({
        workspaceId,
        customerId,
        actor,
        force,
      });

      return {
        content: [
          {
            type: "text",
            text: `Customer ${result.name} (ID: ${result.deletedId}) was permanently deleted.`,
          },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "delete_category",
    {
      title: "Delete Category",
      description:
        "Delete a product category. Requires an explicit productPolicy ('UNASSIGN', 'REASSIGN', or 'REJECT') to ensure products are never accidentally deleted or mismanaged. Destructive action requiring confirmation.",
      inputSchema: {
        categoryId: z.string().describe("The category ID (e.g. cat_...) to delete"),
        productPolicy: z
          .enum(["UNASSIGN", "REASSIGN", "REJECT"])
          .optional()
          .default("UNASSIGN")
          .describe("Policy for products assigned to this category: 'UNASSIGN' to leave them uncategorized, 'REASSIGN' to move them to reassignCategoryId, or 'REJECT' to abort if products exist."),
        reassignCategoryId: z
          .string()
          .optional()
          .describe("Target category ID when productPolicy is 'REASSIGN'"),
        confirmed: z.boolean().optional().default(false).describe("Explicit confirmation flag to execute deletion"),
        confirmationToken: z.string().optional().describe("Confirmation token if pre-authorized via confirmation flow"),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ categoryId, productPolicy, reassignCategoryId, confirmed, confirmationToken }) => {
      requireScope("products:write");
      if (!confirmed && !confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "delete_category",
          parameters: { categoryId, productPolicy, reassignCategoryId },
          riskLevel: "HIGH",
          description: `Delete category "${categoryId}" with productPolicy: "${productPolicy || 'UNASSIGN'}".`,
        });
        return {
          content: [
            {
              type: "text",
              text: `DESTRUCTIVE ACTION CONFIRMATION REQUIRED:\nDeleting category "${categoryId}" (productPolicy: ${productPolicy || 'UNASSIGN'}). To proceed, call delete_category with confirmed: true or confirmationToken: "${conf.confirmationToken}".`,
            },
          ],
          structuredContent: conf,
        };
      }

      if (confirmationToken) {
        await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "delete_category");
      }

      const result = await productService.deleteCategory({
        workspaceId,
        categoryId,
        productPolicy,
        reassignCategoryId,
        actor,
      });

      return {
        content: [
          {
            type: "text",
            text: `Category ${result.name} (ID: ${result.deletedId}) was deleted successfully. Policy: ${result.productPolicy}, products affected: ${result.productsAffected}.${result.warning ? ` Warning: ${result.warning}` : ''}`,
          },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "delete_payment",
    {
      title: "Delete Payment",
      description:
        "Delete a recorded payment. Automatically recalculates order payment balance and restores order payment status to PARTIALLY_PAID or UNPAID. Destructive action requiring explicit confirmation.",
      inputSchema: {
        paymentId: z.string().describe("The payment ID (e.g. pay_...) to delete"),
        confirmed: z.boolean().optional().default(false).describe("Explicit confirmation flag to execute deletion"),
        confirmationToken: z.string().optional().describe("Confirmation token if pre-authorized via confirmation flow"),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ paymentId, confirmed, confirmationToken }) => {
      requireScope("payments:write");
      if (!confirmed && !confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "delete_payment",
          parameters: { paymentId },
          riskLevel: "HIGH",
          description: `Delete payment record "${paymentId}" and recalculate order payment status.`,
        });
        return {
          content: [
            {
              type: "text",
              text: `DESTRUCTIVE ACTION CONFIRMATION REQUIRED:\nDeleting payment "${paymentId}". Associated order payment status will be recalculated. To proceed, call delete_payment with confirmed: true or confirmationToken: "${conf.confirmationToken}".`,
            },
          ],
          structuredContent: conf,
        };
      }

      if (confirmationToken) {
        await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "delete_payment");
      }

      const result = await paymentService.deletePayment({
        workspaceId,
        paymentId,
        actor,
      });

      return {
        content: [
          {
            type: "text",
            text: `Payment ${result.deletedId} for order ${result.orderId} (amount: ₹${result.amount}) was deleted.`,
          },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "delete_return",
    {
      title: "Delete Return",
      description:
        "Delete a customer return request record and associated return items. Destructive action requiring explicit confirmation.",
      inputSchema: {
        returnId: z.string().describe("The return ID (e.g. ret_...) to delete"),
        confirmed: z.boolean().optional().default(false).describe("Explicit confirmation flag to execute deletion"),
        confirmationToken: z.string().optional().describe("Confirmation token if pre-authorized via confirmation flow"),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ returnId, confirmed, confirmationToken }) => {
      requireScope("returns:write");
      if (!confirmed && !confirmationToken) {
        const conf = await confirmationService.createPendingConfirmation({
          workspaceId,
          clientId: principal.clientId,
          toolName: "delete_return",
          parameters: { returnId },
          riskLevel: "HIGH",
          description: `Delete return request "${returnId}".`,
        });
        return {
          content: [
            {
              type: "text",
              text: `DESTRUCTIVE ACTION CONFIRMATION REQUIRED:\nDeleting return record "${returnId}". To proceed, call delete_return with confirmed: true or confirmationToken: "${conf.confirmationToken}".`,
            },
          ],
          structuredContent: conf,
        };
      }

      if (confirmationToken) {
        await confirmationService.verifyAndConsumeConfirmation(workspaceId, confirmationToken, "delete_return");
      }

      const result = await returnService.deleteReturn({
        workspaceId,
        returnId,
        actor,
      });

      return {
        content: [
          {
            type: "text",
            text: `Return record ${result.deletedId} for order ${result.orderId} was deleted.`,
          },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    "factory_reset",
    {
      title: "Factory Reset Platform",
      description:
        "Perform a full platform factory reset to initialize the store and catalog to a clean slate with zero sample data. Safely purges sample products, categories, customers, orders, shipments, payments, returns, and inventory transactions upon master password verification ('Aezakmi@ff135'). The AI assistant must ask the operator for this password before invoking.",
      inputSchema: {
        password: z
          .string()
          .optional()
          .describe(
            "Master security authorization password ('Aezakmi@ff135'). The AI assistant MUST ask the operator for this password before invoking."
          ),
        confirmed: z
          .boolean()
          .optional()
          .default(true)
          .describe("Operator confirmation flag to execute the clean slate reset"),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
    async ({ password, confirmed }) => {
      if (!hasMcpScope(principal.scopes, "products:write") && password?.trim() !== resetService.MASTER_RESET_PASSWORD) {
        throw new Error("FORBIDDEN: Missing required OAuth scope 'products:write'");
      }

      const result = await resetService.executeFactoryReset({
        workspaceId,
        password,
        confirmed,
        actor,
      });

      return {
        content: [
          {
            type: "text",
            text: result.message,
          },
        ],
        structuredContent: result,
      };
    }
  );

  // --- 11. MCP RESOURCES (Section 21) ---

  server.resource(
    "inventory-summary",
    "inventory://summary",
    async (uri) => {
      requireScope("inventory:read");
      const summary = await inventoryService.getInventorySummary(workspaceId);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(summary, null, 2), mimeType: "application/json" }],
      };
    }
  );

  // --- 11. UI RENDER TOOLS (Decoupled MCP Apps Standard & ChatGPT UI Extension) ---

  server.registerTool(
    "render_dashboard_widget",
    {
      title: "Render Dashboard Widget",
      description:
        "Render the interactive executive dashboard widget. Always call get_dashboard_summary first to retrieve authoritative metrics, then pass them to this tool to display the UI in ChatGPT / MCP Apps.",
      inputSchema: {
        dashboardData: z
          .record(z.string(), z.any())
          .optional()
          .describe("Summary metrics from get_dashboard_summary"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: DASHBOARD_WIDGET_URI },
        "openai/outputTemplate": DASHBOARD_WIDGET_URI,
        "openai/toolInvocation/invoking": "Rendering executive dashboard...",
        "openai/toolInvocation/invoked": "Dashboard rendered.",
      },
    },
    async ({ dashboardData }) => {
      requireScope("dashboard:read");
      const summary = dashboardData || (await reportService.getDashboardOverview(workspaceId));
      return {
        content: [
          {
            type: "text",
            text: `Executive dashboard widget rendered with real-time operational metrics (Revenue: ₹${summary?.financials?.totalRevenue || 0}, Physical Stock: ${summary?.products?.physicalStock || 0}).`,
          },
        ],
        structuredContent: summary,
        _meta: {
          ui: { resourceUri: DASHBOARD_WIDGET_URI },
          "openai/outputTemplate": DASHBOARD_WIDGET_URI,
        },
      };
    }
  );

  server.registerTool(
    "render_products_widget",
    {
      title: "Render Products Widget",
      description:
        "Render the interactive product catalog and inventory widget. Always call list_products first to query the catalog, then pass the products to this tool to display the interactive UI.",
      inputSchema: {
        products: z
          .array(z.record(z.string(), z.any()))
          .optional()
          .describe("Array of product items from list_products"),
        filter: z.string().optional().describe("Optional active search or category filter"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: PRODUCTS_WIDGET_URI },
        "openai/outputTemplate": PRODUCTS_WIDGET_URI,
        "openai/toolInvocation/invoking": "Rendering products catalog...",
        "openai/toolInvocation/invoked": "Products catalog rendered.",
      },
    },
    async ({ products: prodsList, filter }) => {
      requireScope("products:read");
      const prods = prodsList || (await productService.listProducts(workspaceId, { search: filter }));
      return {
        content: [
          {
            type: "text",
            text: `Products catalog widget rendered showing ${prods.length} products.`,
          },
        ],
        structuredContent: { products: prods, filter: filter || "" },
        _meta: {
          ui: { resourceUri: PRODUCTS_WIDGET_URI },
          "openai/outputTemplate": PRODUCTS_WIDGET_URI,
        },
      };
    }
  );

  server.registerTool(
    "render_order_widget",
    {
      title: "Render Order Widget",
      description:
        "Render the interactive order inspector widget. Always call get_order first to retrieve order and line item details, then pass them to this tool to display the UI with packing/dispatch actions.",
      inputSchema: {
        order: z
          .record(z.string(), z.any())
          .optional()
          .describe("Complete order details from get_order"),
        orderIdOrNumber: z
          .string()
          .optional()
          .describe("Order ID or order number to inspect if order details not provided"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: ORDER_WIDGET_URI },
        "openai/outputTemplate": ORDER_WIDGET_URI,
        "openai/toolInvocation/invoking": "Rendering order inspector...",
        "openai/toolInvocation/invoked": "Order inspector rendered.",
      },
    },
    async ({ order: orderDetails, orderIdOrNumber }) => {
      requireScope("orders:read");
      let ord = orderDetails;
      if (!ord && orderIdOrNumber) {
        ord = await orderService.getOrderDetails(workspaceId, orderIdOrNumber);
      }
      if (!ord) {
        throw new Error("Must provide order object or orderIdOrNumber to render order widget");
      }
      return {
        content: [
          {
            type: "text",
            text: `Order inspector widget rendered for Order ${ord.orderNumber || ord.id} (Status: ${ord.status}, Total: ₹${ord.totalAmount || 0}).`,
          },
        ],
        structuredContent: ord,
        _meta: {
          ui: { resourceUri: ORDER_WIDGET_URI },
          "openai/outputTemplate": ORDER_WIDGET_URI,
        },
      };
    }
  );

  server.resource(
    "inventory-low-stock",
    "inventory://low-stock",
    async (uri) => {
      requireScope("inventory:read");
      const prods = await productService.listProducts(workspaceId, { lowStockOnly: true });
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(prods, null, 2), mimeType: "application/json" }],
      };
    }
  );

  server.resource(
    "orders-recent",
    "orders://recent",
    async (uri) => {
      requireScope("orders:read");
      const ords = await orderService.listOrders(workspaceId, { limit: 20 });
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(ords, null, 2), mimeType: "application/json" }],
      };
    }
  );

  server.resource(
    "orders-packing-queue",
    "orders://packing-queue",
    async (uri) => {
      requireScope("packing:read");
      const queue = await packingService.listOrdersToPack(workspaceId);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(queue, null, 2), mimeType: "application/json" }],
      };
    }
  );

  server.resource(
    "reports-dashboard",
    "reports://dashboard",
    async (uri) => {
      requireScope("dashboard:read");
      const overview = await reportService.getDashboardOverview(workspaceId);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(overview, null, 2), mimeType: "application/json" }],
      };
    }
  );

  // --- 12. MCP PROMPTS (Section 22) ---

  server.prompt(
    "daily_business_summary",
    "Generate comprehensive daily executive summary for store operations",
    {},
    async () => {
      return {
        description: "Analyze daily operations, new orders, packing backlog, and inventory movements.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please query `get_dashboard_summary`, `get_low_stock_products`, and `list_orders_to_pack`. Summarize today's key operational metrics, highlight urgent bottlenecks, and outline actions for warehouse staff.",
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "prepare_packing_list",
    "Review orders in packing queue and prepare consolidated picking list",
    {},
    async () => {
      return {
        description: "Review pending orders and prepare itemized picking list.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please call `list_orders_to_pack`, aggregate the required product SKUs and quantities across all orders, and generate a clear warehouse picking list.",
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "identify_low_stock",
    "Check inventory levels and recommend stock reorders",
    {},
    async () => {
      return {
        description: "Identify all items below reorder threshold and formulate replenishment advice.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please call `get_low_stock_products` and `get_product_performance`. Identify which top-selling items are at risk of stockout and recommend suggested reorder quantities.",
            },
          },
        ],
      };
    }
  );

  // Register OpenAI Skills Extension (SEP-2640)
  registerSkillsExtension(server);

  // Register MCP Events Extension (Protocol version 2026-07-28 / ChatGPT MCP Events)
  registerEventsExtension(server, principal);

  return server;
}
