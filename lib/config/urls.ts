/**
 * Universal Base URL and MCP URL Resolver
 * Automatically detects the application URL whether running on:
 * 1. Vercel Production / Custom Domain (via VERCEL_PROJECT_PRODUCTION_URL)
 * 2. Vercel Preview Deployment (via VERCEL_URL)
 * 3. Incoming Request Host (via x-forwarded-host / host headers)
 * 4. Explicit Environment Overrides (APP_BASE_URL or APP_URL)
 * 5. Localhost fallback (http://localhost:3000)
 */

export function getBaseUrl(request?: Request): string {
  // 1. Explicit override if set by user
  if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.trim() !== "") {
    return process.env.APP_BASE_URL.trim().replace(/\/$/, "");
  }
  if (process.env.APP_URL && process.env.APP_URL.trim() !== "") {
    return process.env.APP_URL.trim().replace(/\/$/, "");
  }

  // 2. Incoming HTTP request header detection (most accurate for live traffic)
  if (request) {
    try {
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      if (host) {
        return `${proto}://${host}`.replace(/\/$/, "");
      }
      const url = new URL(request.url);
      return `${url.protocol}//${url.host}`.replace(/\/$/, "");
    } catch {
      // fallback
    }
  }

  // 3. Vercel System Environment Variables (automatically provided by Vercel platform)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  // 4. Default local development server
  return "http://localhost:3000";
}

export function getMcpUrl(request?: Request): string {
  if (process.env.MCP_SERVER_URL && process.env.MCP_SERVER_URL.trim() !== "") {
    return process.env.MCP_SERVER_URL.trim().replace(/\/$/, "");
  }
  return `${getBaseUrl(request)}/api/mcp`;
}
