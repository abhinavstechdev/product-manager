import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").notNull().default("INR"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(10),
  orderPrefix: text("order_prefix").notNull().default("ORD"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("VIEWER"), // OWNER, ADMIN, INVENTORY_MANAGER, ORDER_MANAGER, PACKER, VIEWER
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ws_user_idx").on(table.workspaceId, table.userId),
  ]
);

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    description: text("description"),
    imageUrl: text("image_url"),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
    sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
    physicalStock: integer("physical_stock").notNull().default(0),
    reservedStock: integer("reserved_stock").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(10),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ws_sku_idx").on(table.workspaceId, table.sku),
  ]
);

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  changeQty: integer("change_qty").notNull(),
  prevQty: integer("prev_qty").notNull(),
  newQty: integer("new_qty").notNull(),
  transactionType: text("transaction_type").notNull(), // OPENING_STOCK, STOCK_RECEIVED, MANUAL_ADJUSTMENT, STOCK_RESERVED, RESERVATION_RELEASED, ORDER_DISPATCHED, RETURN_RECEIVED, RETURN_APPROVED_RESALE, DAMAGED_GOODS, STOCK_CORRECTION
  reason: text("reason").notNull(),
  orderId: text("order_id"),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorType: text("actor_type").notNull().default("USER"), // USER | AI_AGENT
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  shippingAddress: text("shipping_address").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    shippingAddress: text("shipping_address").notNull(),
    source: text("source").notNull().default("WhatsApp"), // WhatsApp, Phone, Instagram, Facebook, Website, Walk-in, Other
    status: text("status").notNull().default("NEW"), // NEW, CONFIRMED, PROCESSING, PACKED, SHIPPED, DELIVERED, CANCELLED, RETURNED
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0.00"),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    shippingFee: numeric("shipping_fee", { precision: 12, scale: 2 }).notNull().default("0.00"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    paymentStatus: text("payment_status").notNull().default("UNPAID"), // UNPAID, PARTIALLY_PAID, PAID, REFUNDED
    paymentMethod: text("payment_method").default("Cash on Delivery"),
    packingNotes: text("packing_notes"),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ws_ord_num_idx").on(table.workspaceId, table.orderNumber),
  ]
);

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  prevStatus: text("prev_status"),
  newStatus: text("new_status").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  source: text("source").notNull().default("web"), // web | mcp
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shipments = pgTable("shipments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  courier: text("courier").notNull(),
  trackingNumber: text("tracking_number").notNull(),
  shippedAt: timestamp("shipped_at", { withTimezone: true }).defaultNow().notNull(),
  expectedDeliveryAt: timestamp("expected_delivery_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const returns = pgTable("returns", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("REGISTERED"), // REGISTERED, APPROVED, REJECTED
  reason: text("reason").notNull(),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).default("0.00"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const returnItems = pgTable("return_items", {
  id: text("id").primaryKey(),
  returnId: text("return_id")
    .notNull()
    .references(() => returns.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  condition: text("condition").notNull().default("sellable"), // sellable | damaged
  actionTaken: text("action_taken").default("PENDING_INSPECTION"), // PENDING_INSPECTION | RESTOCKED | WRITTEN_OFF
});

export const oauthApplications = pgTable("oauth_applications", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash"),
  clientName: text("client_name").notNull(),
  redirectUris: text("redirect_uris").notNull(), // JSON string array
  scopes: text("scopes").notNull(), // space delimited
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const oauthGrants = pgTable("oauth_grants", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  clientId: text("client_id").notNull(),
  userId: text("user_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  scopes: text("scopes").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const oauthTokens = pgTable("oauth_tokens", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull().unique(),
  refreshToken: text("refresh_token").unique(),
  clientId: text("client_id").notNull(),
  userId: text("user_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  scopes: text("scopes").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorType: text("actor_type").notNull(), // USER | AI_CLIENT | SYSTEM
  toolName: text("tool_name"),
  operation: text("operation").notNull(),
  targetRecord: text("target_record"),
  beforeState: text("before_state"),
  afterState: text("after_state"),
  outcome: text("outcome").notNull(), // SUCCESS | FAILURE | CONFIRMATION_REQUIRED
  errorMessage: text("error_message"),
  idempotencyKey: text("idempotency_key"),
  confirmationRef: text("confirmation_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pendingConfirmations = pgTable("pending_confirmations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  toolName: text("tool_name").notNull(),
  parameters: text("parameters").notNull(), // JSON
  riskLevel: text("risk_level").notNull().default("HIGH"), // MODERATE | HIGH
  description: text("description").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED | EXPIRED
  confirmationToken: text("confirmation_token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    operation: text("operation").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ws_idemp_key_idx").on(table.workspaceId, table.idempotencyKey),
  ]
);

export const eventSubscriptions = pgTable("event_subscriptions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  eventName: text("event_name").notNull(),
  arguments: text("arguments").notNull().default("{}"),
  callbackUrl: text("callback_url").notNull(),
  secret: text("secret").notNull(),
  active: boolean("active").default(true).notNull(),
  refreshBefore: timestamp("refresh_before", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

