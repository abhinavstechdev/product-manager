import { NextResponse } from "next/server";
import { ALL_MCP_SCOPES } from "@/lib/permissions/roles";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = process.env.APP_BASE_URL || `${url.protocol}//${url.host}`;

  return NextResponse.json({
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [`${baseUrl}`],
    scopes_supported: ALL_MCP_SCOPES,
    bearer_methods_supported: ["header"],
  });
}
