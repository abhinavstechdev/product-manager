import { execSync } from "child_process";
import fs from "fs";

// Load .env if present (e.g. during local build tests)
if (typeof process.loadEnvFile === "function" && fs.existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

console.log("\n=======================================================");
console.log("🚀 APEX PLATFORM: BUILD & DEPLOYMENT PRE-CHECK");
console.log("=======================================================");

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl && databaseUrl.trim() !== "") {
  console.log("⚡ DATABASE_URL detected. Executing automatic schema migration on Vercel deployment...");
  try {
    execSync("npx drizzle-kit push --force", { stdio: "inherit" });
    console.log("✓ Database schema synchronized successfully with Neon PostgreSQL!\n");
  } catch (err) {
    console.warn("⚠️ Note: Drizzle push during build exited with notice. Runtime auto-migration will also verify on first query.\n");
  }
} else {
  console.log("ℹ️ No DATABASE_URL provided during build phase. Offline embedded PGlite will initialize at runtime.\n");
}
