import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { products, orders, workspaces, users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const rawDbUrl = process.env.DATABASE_URL;
  const isPostgresConfigured = Boolean(rawDbUrl && rawDbUrl.trim() !== "");

  let dbHost = "ephemeral-in-memory-pglite";
  if (isPostgresConfigured && rawDbUrl) {
    try {
      const parsed = new URL(rawDbUrl);
      dbHost = parsed.host;
    } catch {
      dbHost = "postgres-configured";
    }
  }

  const persistenceMode = isPostgresConfigured
    ? "PERSISTENT_REMOTE_POSTGRES"
    : "EPHEMERAL_IN_MEMORY (DATA RESETS ON EVERY DEPLOY/RESTART)";

  let tableCounts: any = null;
  try {
    const db = await getDb();
    const [pCount] = await (db as any).select({ count: sql`count(*)` }).from(products);
    const [oCount] = await (db as any).select({ count: sql`count(*)` }).from(orders);
    const [uCount] = await (db as any).select({ count: sql`count(*)` }).from(users);
    const [wCount] = await (db as any).select({ count: sql`count(*)` }).from(workspaces);

    tableCounts = {
      products: Number(pCount?.count || 0),
      orders: Number(oCount?.count || 0),
      users: Number(uCount?.count || 0),
      workspaces: Number(wCount?.count || 0),
    };
  } catch (err: any) {
    tableCounts = { error: err?.message };
  }

  return NextResponse.json({
    status: "ok",
    hasDatabaseUrl: isPostgresConfigured,
    dbHost,
    persistenceMode,
    tableCounts,
    warning: !isPostgresConfigured
      ? "CRITICAL: DATABASE_URL is not set in Vercel Environment Variables. Serverless functions are running on an ephemeral in-memory database that wipes all data on every deployment and cold restart."
      : null,
  });
}
