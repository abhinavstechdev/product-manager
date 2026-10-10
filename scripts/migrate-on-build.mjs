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
  console.log("⚡ DATABASE_URL detected. Runtime auto-migration will verify on startup.\n");
} else {
  console.log("ℹ️ No DATABASE_URL provided during build phase. Offline embedded PGlite will initialize at runtime.\n");
}
