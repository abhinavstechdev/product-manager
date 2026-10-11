import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { sql, eq, or, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
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

  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (rawDatabaseUrl && rawDatabaseUrl.trim() !== "") {
    const databaseUrl = rawDatabaseUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, (_, p1, p2) => (p1 === "?" && p2 ? "?" : ""));
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
      const rawDatabaseUrl = process.env.DATABASE_URL;
      if (rawDatabaseUrl && rawDatabaseUrl.trim() !== "") {
        const databaseUrl = rawDatabaseUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, (_, p1, p2) => (p1 === "?" && p2 ? "?" : ""));
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
    // Quick check if schema already exists to prevent redundant network round trips
    let tablesExist = false;
    try {
      await (database as any).select().from(schema.workspaces).limit(1);
      tablesExist = true;
    } catch {
      tablesExist = false;
    }

    if (!tablesExist) {
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
    }

    // Ensure event_subscriptions table exists
    try {
      await (database as any).execute(sql`
        CREATE TABLE IF NOT EXISTS event_subscriptions (
          id text PRIMARY KEY,
          workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          client_id text NOT NULL,
          event_name text NOT NULL,
          arguments text NOT NULL DEFAULT '{}',
          callback_url text NOT NULL,
          secret text NOT NULL,
          active boolean NOT NULL DEFAULT true,
          refresh_before timestamp with time zone NOT NULL,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        );
      `);
    } catch {}

    // Ensure username column exists on users table
    try {
      await (database as any).execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
      `);
    } catch {}

    // Now seed default workspace and initial data if empty
    await seedInitialData(database);

    // Ensure seveton admin user is created/updated with correct credentials
    await ensureAdminUser(database);
  } catch (err) {
    console.error("Error ensuring schema and seed:", err);
  }
}

export async function ensureAdminUser(database: AppDatabase) {
  try {
    const defaultWorkspaceId = "ws_apex_main";
    const passwordHash = await bcrypt.hash("Aezakmi@ff135", 10);
    const now = new Date();

    // Check if seveton user exists
    const [existing] = await (database as any)
      .select()
      .from(schema.users)
      .where(
        or(
          eq(schema.users.email, "seveton@apexlogistics.com"),
          eq(schema.users.username, "seveton"),
          eq(schema.users.name, "seveton"),
          eq(schema.users.id, "usr_seveton_main")
        )
      )
      .limit(1);

    const userId = existing ? existing.id : "usr_seveton_main";

    if (!existing) {
      await (database as any).insert(schema.users).values({
        id: userId,
        name: "seveton",
        username: "seveton",
        email: "seveton@apexlogistics.com",
        passwordHash,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await (database as any)
        .update(schema.users)
        .set({
          name: "seveton",
          username: "seveton",
          passwordHash,
          updatedAt: now,
        })
        .where(eq(schema.users.id, userId));
    }

    // Ensure membership with OWNER role
    const [membership] = await (database as any)
      .select()
      .from(schema.workspaceMemberships)
      .where(
        and(
          eq(schema.workspaceMemberships.workspaceId, defaultWorkspaceId),
          eq(schema.workspaceMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      await (database as any).insert(schema.workspaceMemberships).values({
        id: `mem_${userId}`,
        workspaceId: defaultWorkspaceId,
        userId: userId,
        role: "OWNER",
        createdAt: now,
      });
    } else if (membership.role !== "OWNER") {
      await (database as any)
        .update(schema.workspaceMemberships)
        .set({ role: "OWNER" })
        .where(eq(schema.workspaceMemberships.id, membership.id));
    }
  } catch (err) {
    console.error("Error ensuring seveton user:", err);
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

    // 4. Register OAuth Application for MCP Assistants
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

    console.log("Database initialized cleanly for Apex Logistics (clean fresh slate, no fake data).");
  } catch (err) {
    console.error("Error seeding initial data:", err);
  }
}
