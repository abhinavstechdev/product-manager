import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { sql, eq } from "drizzle-orm";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

// Shared database interface type
export type AppDatabase = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

let cachedDb: AppDatabase | null = null;
let initPromise: Promise<void> | null = null;

export async function getDb(): Promise<AppDatabase> {
  if (cachedDb) {
    if (initPromise) await initPromise;
    return cachedDb;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.trim() !== "") {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    });
    const db = drizzlePg(pool, { schema });
    cachedDb = db;
  } else {
    // Persistent embedded Postgres via PGlite in .data/pglite or in-memory
    const dataDir = path.join(process.cwd(), ".data", "pglite");
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch {
      // Ignore if serverless read-only
    }
    
    // Fall back to memory if filesystem is unwritable (e.g. read-only serverless sandbox without DB URL)
    let pgliteInstance: PGlite;
    try {
      pgliteInstance = new PGlite(dataDir);
    } catch {
      pgliteInstance = new PGlite();
    }
    
    const db = drizzlePglite(pgliteInstance, { schema });
    cachedDb = db;
  }

  initPromise = ensureSchemaAndSeed(cachedDb);
  await initPromise;
  return cachedDb;
}

// Synchronous wrapper / getter for Next.js Server Components and route handlers
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    if (!cachedDb) {
      // Synchronous lazy initialize with PGlite if not already initialized
      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl && databaseUrl.trim() !== "") {
        const pool = new Pool({
          connectionString: databaseUrl,
          max: 10,
          ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
        });
        cachedDb = drizzlePg(pool, { schema });
      } else {
        const dataDir = path.join(process.cwd(), ".data", "pglite");
        try {
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        } catch {}
        try {
          cachedDb = drizzlePglite(new PGlite(dataDir), { schema });
        } catch {
          cachedDb = drizzlePglite(new PGlite(), { schema });
        }
      }
      ensureSchemaAndSeed(cachedDb).catch((err) => {
        console.error("Auto schema init error:", err);
      });
    }
    return (cachedDb as any)[prop];
  },
});

let schemaInitialized = false;

export async function ensureSchemaAndSeed(database: AppDatabase) {
  if (schemaInitialized) return;
  schemaInitialized = true;

  try {
    // Read the generated SQL migration file
    const migrationPath = path.join(process.cwd(), "drizzle", "0000_flaky_iron_monger.sql");
    if (fs.existsSync(migrationPath)) {
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        try {
          await (database as any).execute(statement);
        } catch {
          // Ignore table already exists or constraint already exists errors
        }
      }
    }

    // Now seed default workspace and initial data if empty
    await seedInitialData(database);
  } catch (err) {
    console.error("Error ensuring schema and seed:", err);
  }
}

export async function seedInitialData(database: AppDatabase) {
  try {
    const existingWorkspaces = await (database as any)
      .select()
      .from(schema.workspaces)
      .limit(1);

    if (existingWorkspaces.length > 0) {
      return; // Already seeded
    }

    const defaultWorkspaceId = "ws_apex_main";
    const defaultUserId = "usr_owner_main";
    const now = new Date();

    // 1. Create Workspace
    await (database as any).insert(schema.workspaces).values({
      id: defaultWorkspaceId,
      name: "Apex Logistics & Retail",
      slug: "apex-logistics",
      currency: "INR",
      lowStockThreshold: 10,
      orderPrefix: "ORD",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create Owner User (password: password123)
    // bcrypt hash of "password123":
    const passwordHash = "$2a$10$7R6QO4fBvY8z9X6v4Y5.yeM4mJ/1qA1e9d2uL6x3c7c2mG9e6K5e6"; // We can also use bcryptjs dynamically

    await (database as any).insert(schema.users).values({
      id: defaultUserId,
      name: "Rohan Sharma (Store Owner)",
      email: "owner@apexlogistics.com",
      passwordHash: passwordHash,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Create Membership (role OWNER)
    await (database as any).insert(schema.workspaceMemberships).values({
      id: "mem_owner_main",
      workspaceId: defaultWorkspaceId,
      userId: defaultUserId,
      role: "OWNER",
      createdAt: now,
    });

    // 4. Create Categories
    const categoriesData = [
      { id: "cat_electronics", name: "Electronics & Audio", description: "Smartphones, earphones, accessories" },
      { id: "cat_apparel", name: "Apparel & Shoes", description: "Clothing and premium streetwear" },
      { id: "cat_home", name: "Home & Kitchen", description: "Appliances and ergonomic essentials" },
    ];
    for (const cat of categoriesData) {
      await (database as any).insert(schema.categories).values({
        id: cat.id,
        workspaceId: defaultWorkspaceId,
        name: cat.name,
        description: cat.description,
        isActive: true,
        createdAt: now,
      });
    }

    // 5. Create Products with Initial Physical Stock and Inventory Transactions
    const initialProducts = [
      {
        id: "prd_noise_cancelling_headphones",
        name: "Wireless ANC Over-Ear Headphones",
        sku: "AUD-ANC-001",
        categoryId: "cat_electronics",
        cost: "2499.00",
        price: "4999.00",
        stock: 35,
        threshold: 10,
        description: "High-fidelity active noise-cancelling headphones with 40-hour battery life",
      },
      {
        id: "prd_smart_fitness_band",
        name: "PulseFit Pro Smart Band",
        sku: "FIT-BND-002",
        categoryId: "cat_electronics",
        cost: "950.00",
        price: "1899.00",
        stock: 8, // Low stock!
        threshold: 15,
        description: "OLED heart-rate and SpO2 tracker with waterproof casing",
      },
      {
        id: "prd_organic_cotton_hoodie",
        name: "Premium Heavyweight Cotton Hoodie",
        sku: "APP-HD-BLK",
        categoryId: "cat_apparel",
        cost: "600.00",
        price: "1450.00",
        stock: 50,
        threshold: 12,
        description: "420 GSM brushed fleece oversized unisex black hoodie",
      },
      {
        id: "prd_ergonomic_desk_lamp",
        name: "Adjustable LED Task Lamp",
        sku: "HOM-LMP-004",
        categoryId: "cat_home",
        cost: "450.00",
        price: "1199.00",
        stock: 22,
        threshold: 5,
        description: "Touch-dimmable warm and cool white reading desk lamp",
      },
      {
        id: "prd_running_shoes_knit",
        name: "AeroGlide Knit Running Shoes",
        sku: "APP-SH-005",
        categoryId: "cat_apparel",
        cost: "1100.00",
        price: "2799.00",
        stock: 4, // Low stock!
        threshold: 10,
        description: "Breathable mesh lightweight running sneakers",
      },
    ];

    for (const p of initialProducts) {
      await (database as any).insert(schema.products).values({
        id: p.id,
        workspaceId: defaultWorkspaceId,
        categoryId: p.categoryId,
        name: p.name,
        sku: p.sku,
        purchaseCost: p.cost,
        sellingPrice: p.price,
        physicalStock: p.stock,
        reservedStock: 0,
        reorderThreshold: p.threshold,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Record opening stock transaction in ledger
      await (database as any).insert(schema.inventoryTransactions).values({
        id: `tx_open_${p.sku}`,
        workspaceId: defaultWorkspaceId,
        productId: p.id,
        changeQty: p.stock,
        prevQty: 0,
        newQty: p.stock,
        transactionType: "OPENING_STOCK",
        reason: "Initial warehouse stock intake",
        actorId: defaultUserId,
        actorName: "Rohan Sharma",
        actorType: "USER",
        createdAt: now,
      });
    }

    // 6. Create Demo Customers
    const initialCustomers = [
      {
        id: "cust_priya_sharma",
        name: "Priya Sharma",
        phone: "+91 98765 43210",
        email: "priya.sharma@example.com",
        address: "Flat 402, Green Glen Layout, Bellandur, Bengaluru, KA - 560103",
        notes: "Preferred delivery before 5 PM",
      },
      {
        id: "cust_aarav_patel",
        name: "Aarav Patel",
        phone: "+91 98220 12345",
        email: "aarav.p@example.com",
        address: "74 Galaxy Heights, Bandra West, Mumbai, MH - 400050",
        notes: "Call on arrival",
      },
      {
        id: "cust_ananya_reddy",
        name: "Ananya Reddy",
        phone: "+91 94401 98765",
        email: "ananya.r@example.com",
        address: "Villa 12, Jubilee Hills, Road No. 36, Hyderabad, TS - 500033",
        notes: "Corporate client",
      },
    ];

    for (const c of initialCustomers) {
      await (database as any).insert(schema.customers).values({
        id: c.id,
        workspaceId: defaultWorkspaceId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        shippingAddress: c.address,
        notes: c.notes,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 7. Create Demo Orders in different realistic states
    // Order 1: Delivered & Paid
    const ord1Id = "ord_001_deliv";
    await (database as any).insert(schema.orders).values({
      id: ord1Id,
      workspaceId: defaultWorkspaceId,
      orderNumber: "ORD-2026-000101",
      customerId: "cust_priya_sharma",
      shippingAddress: "Flat 402, Green Glen Layout, Bellandur, Bengaluru, KA - 560103",
      source: "WhatsApp",
      status: "DELIVERED",
      subtotal: "4999.00",
      discount: "500.00",
      shippingFee: "100.00",
      totalAmount: "4599.00",
      paymentStatus: "PAID",
      paymentMethod: "UPI",
      packingNotes: "Bubble wrap fragile earphones box",
      notes: "Ordered via WhatsApp catalog inquiry",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    });
    await (database as any).insert(schema.orderItems).values({
      id: "oi_001_1",
      orderId: ord1Id,
      productId: "prd_noise_cancelling_headphones",
      sku: "AUD-ANC-001",
      productName: "Wireless ANC Over-Ear Headphones",
      quantity: 1,
      unitPrice: "4999.00",
      discount: "500.00",
      totalPrice: "4499.00",
    });
    await (database as any).insert(schema.orderStatusHistory).values({
      id: "osh_001_1",
      orderId: ord1Id,
      prevStatus: "SHIPPED",
      newStatus: "DELIVERED",
      actorId: defaultUserId,
      actorName: "Rohan Sharma",
      source: "web",
      note: "Customer confirmed delivery",
      createdAt: now,
    });
    await (database as any).insert(schema.payments).values({
      id: "pay_001",
      workspaceId: defaultWorkspaceId,
      orderId: ord1Id,
      amount: "4599.00",
      paymentMethod: "UPI",
      reference: "UPI/20261008/7829104",
      notes: "Received via PhonePe merchant QR",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    // Order 2: Packed - ready to ship!
    const ord2Id = "ord_002_pack";
    await (database as any).insert(schema.orders).values({
      id: ord2Id,
      workspaceId: defaultWorkspaceId,
      orderNumber: "ORD-2026-000102",
      customerId: "cust_aarav_patel",
      shippingAddress: "74 Galaxy Heights, Bandra West, Mumbai, MH - 400050",
      source: "Instagram",
      status: "PACKED",
      subtotal: "2900.00",
      discount: "0.00",
      shippingFee: "80.00",
      totalAmount: "2980.00",
      paymentStatus: "PAID",
      paymentMethod: "Bank transfer",
      packingNotes: "Pack in branded apex polybag",
      notes: "Direct message on Instagram shop",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: now,
    });
    await (database as any).insert(schema.orderItems).values({
      id: "oi_002_1",
      orderId: ord2Id,
      productId: "prd_organic_cotton_hoodie",
      sku: "APP-HD-BLK",
      productName: "Premium Heavyweight Cotton Hoodie",
      quantity: 2,
      unitPrice: "1450.00",
      discount: "0.00",
      totalPrice: "2900.00",
    });
    // Reserved stock for ord2
    await (database as any)
      .update(schema.products)
      .set({ reservedStock: 2 })
      .where(sql`${schema.products.id} = 'prd_organic_cotton_hoodie'`);

    // Order 3: Confirmed - waiting to pack!
    const ord3Id = "ord_003_conf";
    await (database as any).insert(schema.orders).values({
      id: ord3Id,
      workspaceId: defaultWorkspaceId,
      orderNumber: "ORD-2026-000103",
      customerId: "cust_ananya_reddy",
      shippingAddress: "Villa 12, Jubilee Hills, Road No. 36, Hyderabad, TS - 500033",
      source: "Phone",
      status: "CONFIRMED",
      subtotal: "3098.00",
      discount: "200.00",
      shippingFee: "0.00",
      totalAmount: "2898.00",
      paymentStatus: "UNPAID",
      paymentMethod: "Cash on Delivery",
      packingNotes: "Include warranty card",
      notes: "Urgent delivery request",
      createdAt: now,
      updatedAt: now,
    });
    await (database as any).insert(schema.orderItems).values({
      id: "oi_003_1",
      orderId: ord3Id,
      productId: "prd_smart_fitness_band",
      sku: "FIT-BND-002",
      productName: "PulseFit Pro Smart Band",
      quantity: 1,
      unitPrice: "1899.00",
      discount: "0.00",
      totalPrice: "1899.00",
    });
    await (database as any).insert(schema.orderItems).values({
      id: "oi_003_2",
      orderId: ord3Id,
      productId: "prd_ergonomic_desk_lamp",
      sku: "HOM-LMP-004",
      productName: "Adjustable LED Task Lamp",
      quantity: 1,
      unitPrice: "1199.00",
      discount: "200.00",
      totalPrice: "999.00",
    });
    // Reserved stock for ord3
    await (database as any)
      .update(schema.products)
      .set({ reservedStock: 1 })
      .where(sql`${schema.products.id} = 'prd_smart_fitness_band'`);
    await (database as any)
      .update(schema.products)
      .set({ reservedStock: 1 })
      .where(sql`${schema.products.id} = 'prd_ergonomic_desk_lamp'`);

    // 8. Register OAuth Application for MCP Assistants
    await (database as any).insert(schema.oauthApplications).values({
      id: "app_claude_desktop",
      workspaceId: defaultWorkspaceId,
      clientId: "mcp-desktop-client-01",
      clientSecretHash: null, // Public PKCE client
      clientName: "Claude / Antigravity AI Assistant",
      redirectUris: JSON.stringify(["http://localhost:3000/callback", "https://oauth.pstmn.io/v1/callback"]),
      scopes: "dashboard:read products:read products:write inventory:read inventory:write customers:read customers:write orders:read orders:create orders:update orders:cancel packing:read packing:write shipping:read shipping:write payments:read payments:write returns:read returns:write reports:read reports:export audit:read",
      createdAt: now,
    });

    console.log("Database initialized and seeded successfully with Apex Logistics sample data!");
  } catch (err) {
    console.error("Error seeding initial data:", err);
  }
}
